/**
 * 成績算出エンジン
 * GradeItem × DataSource ベースで評価項目ごとの成績を算出（評定も評価項目の一つ）
 * 欠測時の代替スコア推定（average / regression / zero）に対応
 *
 * DB から読むのは `gradeCalculationContext.ts`（素点行列の組み立て）で、ここは読まない。
 * 手法選択画面のモデル適合度 R は `gradeSourceFit.ts`。
 */

import type {
  EstimationDetail,
  EstimationTargetDistribution,
  GradeCalculationResult,
  GradeItemResult,
  SourceScoreResult,
  StudentGradeResult,
} from "../../../../src/types/grade.types"
import {
  toAbsentMethod,
  toGradeDataSourceType,
} from "../../../../src/types/grade.types"
import {
  adjustEstimate,
  applyAdjustmentAndClamp,
  estimateAbsentScore,
} from "./absentEstimation"
import { buildGradeCalcContext } from "./gradeCalculationContext"
import type { DataSourceInfo } from "./gradeCalculatorTypes"
import { determineGradeLabel } from "./gradeLabel"
import { findCourseworkStudentScore } from "./rawScoreCalculator"
import type { RawScoreMatrix } from "./rawScoreMatrix"

/** float の丸め誤差で確定値とライブ値の食い違いを誤検知しないよう小数4桁で比較する */
const roundForCompare = (value: number): number => Math.round(value * 1e4) / 1e4

const sameNumber = (left: number | null, right: number | null): boolean =>
  left === null || right === null
    ? left === right
    : roundForCompare(left) === roundForCompare(right)

const toIsoString = (value: Date | string): string =>
  typeof value === "string" ? value : value.toISOString()

/**
 * 成績を算出する。
 *
 * 確定（凍結）済みのセルは既定で確定値を最優先で返す（採用順は 確定値 > 手動上書き >
 * 自動算出値）。結果表・Excel・個票・制約評価はすべてこの関数を通るため、ここで差し替える
 * ことで全出力が確定値で一貫する。
 *
 * @param options.applyFrozen 確定値を適用するか（既定 true）。確定操作そのものは
 *   「今のライブ値を取り込む」ものなので false で呼ぶ。true のまま呼ぶと再確定が
 *   確定値自身を焼き直すだけになる。
 */
export async function calculateGrades(
  gradeId: string,
  options?: { applyFrozen?: boolean }
): Promise<GradeCalculationResult> {
  const applyFrozen = options?.applyFrozen ?? true
  // 素点行列と付随データ（推定に必要な文脈）をまとめて構築。
  // computeSourceFits（手法選択画面のモデル適合度R）と共有する（SSOT）。
  const context = await buildGradeCalcContext(gradeId)
  if (!context) {
    throw new Error("Grade exam not found")
  }
  const {
    grade,
    classroomIds,
    liveMaxScoreMap,
    dataSourceInfos,
    rawScoreMatrix,
  } = context

  // 各ソースの実測素点分布（平均・標準偏差）はソース単位で一定なので、生徒ループの外で
  // 1ソース1回だけ算出してマップ化する。閲覧生徒は除外しない（＝クラスの実測分布として
  // 全生徒共通の値。以前は閲覧生徒を除いていたため生徒ごとに平均がわずかに変動していた）。
  const distributionBySource = new Map<
    string,
    EstimationTargetDistribution | undefined
  >()
  for (const dataSourceInfo of dataSourceInfos) {
    distributionBySource.set(
      dataSourceInfo.id,
      computeSourceDistribution(dataSourceInfo, rawScoreMatrix)
    )
  }

  // === パス2: 推定 + 重み付け ===
  const students: StudentGradeResult[] = []

  for (const rawScoreRow of rawScoreMatrix.rows) {
    const gradeStudent = rawScoreRow.gradeStudent
    const student = gradeStudent.student
    const membership = student.memberships.find((membership) =>
      classroomIds.includes(membership.classroomId)
    )
    const gradeItemResults: GradeItemResult[] = []

    for (const gradeItem of grade.gradeItems) {
      // 除外チェック。除外設定は対象者の子なので、この対象者の分しか見えない
      const isExcluded = gradeStudent.itemExclusions.some(
        (itemExclusion) => itemExclusion.gradeItemId === gradeItem.id
      )
      if (isExcluded) {
        gradeItemResults.push({
          gradeItemId: gradeItem.id,
          gradeItemName: gradeItem.name,
          isExcluded: true,
          isAllMissing: false,
          sourceScores: [],
          weightedScore: null,
          weightedMaxScore: 0,
          percentage: null,
          gradeLabel: null,
          originalGradeLabel: null,
          overrideGradeLabel: null,
          frozen: null,
        })
        continue
      }

      const sourceScores: SourceScoreResult[] = []

      for (const dataSource of gradeItem.dataSources) {
        // 満点は元データからライブ算出した値を使う（maxScore列は使わない）
        const maxScore = liveMaxScoreMap.get(dataSource.id) ?? 0
        const weight = Number(dataSource.weight)
        const absentMethod = toAbsentMethod(dataSource.absentMethod)
        const absentRatio = Number(dataSource.absentRatio ?? 1)
        const absentOffset = Number(dataSource.absentOffset ?? 0)

        const dataSourceInfo = dataSourceInfos.find(
          (sourceInfo) => sourceInfo.id === dataSource.id
        )

        let rawScore = dataSourceInfo
          ? rawScoreMatrix.scoreOf(rawScoreRow, dataSourceInfo)
          : null
        let isEstimated = false
        let estimationDetail: EstimationDetail | null = null

        // rawScoreがnullかつ推定設定がある場合、代替スコアを算出
        if (rawScore === null && absentMethod !== "null" && dataSourceInfo) {
          // ソース選択対応: estimationMode === "selected" の場合、指定IDのみ使用
          const sourcesToUse =
            dataSourceInfo.estimationMode === "selected"
              ? dataSourceInfos.filter((sourceInfo) =>
                  dataSourceInfo.estimationSourceIds.includes(sourceInfo.id)
                )
              : dataSourceInfos

          const estimation = estimateAbsentScore(
            absentMethod,
            rawScoreRow,
            dataSourceInfo,
            rawScoreMatrix,
            sourcesToUse
          )
          if (estimation !== null) {
            // 調整 + クランプ
            rawScore = applyAdjustmentAndClamp(
              estimation.value,
              absentRatio,
              absentOffset,
              maxScore
            )
            isEstimated = true
            // 結果画面のpopoverで「どう推定したか」を表示するための内訳。
            // adjustedScore は applyAdjustmentAndClamp と同じ adjustEstimate を共有し、
            // 表示側で式を再導出しない（SSOT）。
            estimationDetail = {
              effectiveMethod: estimation.effectiveMethod,
              baseEstimate: estimation.value,
              ratio: absentRatio,
              offset: absentOffset,
              adjustedScore: adjustEstimate(
                estimation.value,
                absentRatio,
                absentOffset
              ),
              finalScore: rawScore,
              averageSources: estimation.averageSources,
              averageRatio: estimation.averageRatio,
              intercept: estimation.intercept,
              regressionTerms: estimation.regressionTerms,
              droppedPredictors: estimation.droppedPredictors,
              fallbackReason: estimation.fallbackReason,
              correlation: estimation.correlation,
              standardizedStanding: estimation.standardizedStanding,
              percentileRank: estimation.percentileRank,
              targetMean: estimation.targetMean,
              targetStandardDeviation: estimation.targetStandardDeviation,
            }
          }
        }

        const weightedScore =
          rawScore !== null && maxScore > 0
            ? (rawScore / maxScore) * weight
            : null

        // coursework型: 入力された評価記号・加減点・コメントを結果に添付
        const courseworkScore =
          dataSource.type === "coursework" && dataSource.courseworkItem
            ? findCourseworkStudentScore(student.id, dataSource.courseworkItem)
            : undefined

        sourceScores.push({
          dataSourceId: dataSource.id,
          dataSourceName: dataSource.name,
          type: toGradeDataSourceType(dataSource.type),
          rawScore,
          maxScore,
          weight,
          weightedScore,
          isEstimated,
          estimation: estimationDetail,
          // このテストを実際に受けた生徒の素点分布（平均・標準偏差）。
          // 素点がクラスの実態のどこに位置するか（説明責任の判断材料）を内訳表に併記。
          // ソース単位で事前算出した共通の分布を参照（全生徒で同一値）。
          distribution: distributionBySource.get(dataSource.id),
          letterValue: courseworkScore?.letterValue ?? null,
          adjustment:
            courseworkScore?.adjustment !== null &&
            courseworkScore?.adjustment !== undefined
              ? Number(courseworkScore.adjustment)
              : null,
          adjustmentReason: courseworkScore?.adjustmentReason ?? null,
          comment: courseworkScore?.comment ?? null,
        })
      }

      // GradeItemの重み付け合計（欠点以外のみ分母に含める）
      const nonNullSources = sourceScores.filter(
        (sourceScore) => sourceScore.weightedScore !== null
      )

      let weightedMax: number
      let weightedScore: number | null

      let isAllMissing = false

      if (nonNullSources.length > 0) {
        weightedMax = nonNullSources.reduce(
          (sum, sourceScore) => sum + sourceScore.weight,
          0
        )
        weightedScore = nonNullSources.reduce(
          (sum, sourceScore) => sum + sourceScore.weightedScore!,
          0
        )
      } else if (sourceScores.length > 0) {
        // 全スコアがnull → 換算合計0点として扱う
        weightedMax = sourceScores.reduce(
          (sum, sourceScore) => sum + sourceScore.weight,
          0
        )
        weightedScore = 0
        isAllMissing = true
      } else {
        weightedMax = 0
        weightedScore = null
      }

      const percentage =
        weightedScore !== null && weightedMax > 0
          ? (weightedScore / weightedMax) * 100
          : null

      // 評価項目の境界からラベルを決定。境界が1本も無ければラベルは付かない
      const originalGradeLabel = determineGradeLabel(
        percentage,
        gradeItem.boundaries
      )
      // 上書き・確定値も対象者の子。この対象者の分しか見えないので、名簿から外した
      // 生徒の設定を拾うことは構造的に起こらない
      const overrideGradeLabel =
        gradeStudent.overrides.find(
          (override) => override.gradeItemId === gradeItem.id
        )?.overrideLabel ?? null
      // ライブの実効値＝自動算出を手動上書きで調整した後の値。確定操作はこれを取り込む。
      const liveGradeLabel = overrideGradeLabel ?? originalGradeLabel

      const frozenScore = applyFrozen
        ? gradeStudent.frozenScores.find(
            (candidate) => candidate.gradeItemId === gradeItem.id
          )
        : undefined
      if (frozenScore) {
        const frozenWeightedScore =
          frozenScore.weightedScore !== null
            ? Number(frozenScore.weightedScore)
            : null
        const frozenWeightedMaxScore = Number(frozenScore.weightedMaxScore)
        const frozenPercentage =
          frozenScore.percentage !== null
            ? Number(frozenScore.percentage)
            : null

        gradeItemResults.push({
          gradeItemId: gradeItem.id,
          gradeItemName: gradeItem.name,
          isExcluded: false,
          isAllMissing,
          sourceScores,
          weightedScore: frozenWeightedScore,
          weightedMaxScore: frozenWeightedMaxScore,
          percentage: frozenPercentage,
          gradeLabel: frozenScore.gradeLabel,
          originalGradeLabel,
          overrideGradeLabel,
          frozen: {
            frozenAt: toIsoString(frozenScore.frozenAt),
            isStale:
              !sameNumber(frozenPercentage, percentage) ||
              !sameNumber(frozenWeightedScore, weightedScore) ||
              !sameNumber(frozenWeightedMaxScore, weightedMax) ||
              frozenScore.gradeLabel !== liveGradeLabel,
            liveWeightedScore: weightedScore,
            liveWeightedMaxScore: weightedMax,
            livePercentage: percentage,
            liveGradeLabel,
          },
        })
        continue
      }

      gradeItemResults.push({
        gradeItemId: gradeItem.id,
        gradeItemName: gradeItem.name,
        isExcluded: false,
        isAllMissing,
        sourceScores,
        weightedScore,
        weightedMaxScore: weightedMax,
        percentage,
        gradeLabel: liveGradeLabel,
        originalGradeLabel,
        overrideGradeLabel,
        frozen: null,
      })
    }

    students.push({
      gradeStudentId: gradeStudent.id,
      studentId: student.id,
      studentNumber: student.studentNumber,
      lastName: student.lastName,
      firstName: student.firstName,
      attendanceNumber: membership?.attendanceNumber ?? null,
      className: membership?.classroom.name ?? null,
      gradeItemResults,
    })
  }

  return {
    gradeId: grade.id,
    gradeName: grade.name,
    classNames: grade.gradeClassrooms.map(
      (gradeClassroom) => gradeClassroom.classroom.name
    ),
    gradeItems: grade.gradeItems.map((gradeItem) => ({
      id: gradeItem.id,
      name: gradeItem.name,
      order: gradeItem.order,
      // 内訳列の定義。生徒の除外に左右されない項目そのものの構成を渡す
      dataSources: gradeItem.dataSources.map((dataSource) => ({
        id: dataSource.id,
        name: dataSource.name,
      })),
      boundaries: [...gradeItem.boundaries]
        .sort(
          (boundaryA, boundaryB) =>
            Number(boundaryB.minPercentage) - Number(boundaryA.minPercentage)
        )
        .map((boundary) => ({
          label: boundary.label,
          minPercentage: Number(boundary.minPercentage),
          order: boundary.order,
        })),
    })),
    students,
  }
}

/**
 * 当該データソース（テスト）を実測した全生徒の素点分布（平均・母標準偏差）を算出する。
 * 実測値（rawScoreMap の非null）のみを母数とし、欠席（null）は含めない。閲覧生徒も含めた
 * クラスの実測分布なので、どの生徒の内訳popoverでも同一値になる（＝表示ラベルと一致）。
 * 標準偏差算出のため2名以上を要する。ソース単位で一定のため生徒ループの外で1回だけ呼ぶ。
 *
 * 注: 標準偏差法・順位法の載せ替えで使う absentEstimationEquating.collectTargetDistribution とは
 * 意味論が異なる（あちらは対象生徒を母数から除く leave-one-out ＋整列列を返す）ため別実装。
 */
function computeSourceDistribution(
  dataSource: DataSourceInfo,
  rawScoreMatrix: RawScoreMatrix
): EstimationTargetDistribution | undefined {
  const scores = rawScoreMatrix.measuredColumn(dataSource)
  if (scores.length < 2) return undefined
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length
  const variance =
    scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length
  return {
    sampleSize: scores.length,
    mean,
    standardDeviation: Math.sqrt(variance),
  }
}
