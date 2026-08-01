/**
 * 成績算出エンジン
 * GradeItem × DataSource ベースで評価項目ごとの成績を算出（評定も評価項目の一つ）
 * 欠測時の代替スコア推定（average / regression / zero）に対応
 */

import type {
  AbsentMethod,
  EstimationDetail,
  EstimationTargetDistribution,
  GradeCalculationResult,
  GradeItemResult,
  SourceScoreResult,
  StudentGradeResult,
} from "../../../../src/types/grade.types"
import { toGradeDataSourceType } from "../../../../src/types/grade.types"
import prisma from "../../prisma/client"
import { getQuestionAssignmentsBySubtotalIds } from "../../prisma/cropSubtotal"
import { computeLiveMaxScore } from "../../prisma/gradeDataSource"
import {
  adjustEstimate,
  applyAdjustmentAndClamp,
  computeSourceFit,
  estimateAbsentScore,
} from "./absentEstimation"
import { findExamStudentScores } from "./examScoreCalculator"
import type { DataSourceInfo, ExamDataCache } from "./gradeCalculatorTypes"
import { gradeStudentForCalcInclude } from "./gradeCalculatorTypes"
import { determineGradeLabel } from "./gradeLabel"
import { findCourseworkStudentScore, getRawScore } from "./rawScoreCalculator"
import type { RawScoreCell, RawScoreRow } from "./rawScoreMatrix"
import { RawScoreMatrix } from "./rawScoreMatrix"
import { resolveEffectiveScores } from "./scoreResolution"

/**
 * 素点行列と推定に必要な付随データを構築する。
 * calculateGrades のパス1と computeSourceFits が共有する（素点組み立ての単一実装＝SSOT）。
 * @returns 構築した文脈。Grade が存在しない場合は null。
 */
async function buildGradeCalcContext(gradeId: string) {
  // 1. Grade + リレーションを取得
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
    include: {
      gradeClassrooms: {
        include: { classroom: true },
        orderBy: { order: "asc" },
      },
      gradeItems: {
        include: {
          dataSources: {
            include: {
              exam: true,
              subtotal: true,
              cropRegion: true,
              estimationSources: { orderBy: { order: "asc" } },
              // 点数は資料の対象者（CourseworkStudent）経由でのみ引ける。
              // 名簿から外された生徒の点数は存在しえないため算出に混ざらない（#962）。
              courseworkItem: {
                include: {
                  scores: { include: { courseworkStudent: true } },
                  letterScales: { orderBy: { order: "asc" } },
                },
              },
              coursework: {
                include: {
                  items: {
                    include: {
                      scores: { include: { courseworkStudent: true } },
                      letterScales: { orderBy: { order: "asc" } },
                    },
                  },
                },
              },
            },
            orderBy: { order: "asc" },
          },
          boundaries: { orderBy: { order: "asc" } },
        },
        orderBy: { order: "asc" },
      },
    },
  })

  if (!grade) return null

  // 2. 成績の対象者一覧を取得。
  //
  // 上書き・確定値・除外設定は対象者の子として同じクエリで引く。以前は Grade 単位で
  // 別々に引いて `${studentId}:${gradeItemId}` の文字列キーで突き合わせており、
  // 名簿に居ない生徒の設定も一緒に読み込んでいた（#962 §3.3）。
  const gradeStudents = await prisma.gradeStudent.findMany({
    where: { gradeId },
    include: gradeStudentForCalcInclude,
    orderBy: [{ customOrder: "asc" }, { createdAt: "asc" }],
  })

  const classroomIds = grade.gradeClassrooms.map(
    (gradeClassroom) => gradeClassroom.classroomId
  )

  // 3. 全DataSourceから使用される試験試験IDを収集
  const allDataSources = grade.gradeItems.flatMap(
    (gradeItem) => gradeItem.dataSources
  )
  const examIds = [
    ...new Set(
      allDataSources
        .filter(
          (dataSource) =>
            (dataSource.type === "exam_total" ||
              dataSource.type === "subtotal" ||
              dataSource.type === "crop_region") &&
            dataSource.examId
        )
        .map((dataSource) => dataSource.examId!)
    ),
  ]

  // 4. 試験のスコアデータを事前取得
  //
  // 起点は ExamStudent（その試験の受験者）で、採点行はその子として引く。
  // 「試験から外した生徒の採点行」は受験者が居ないので構造的に集まらない
  // （以前は CropRegion 起点で引いており、外したはずの生徒の得点が
  //  成績算出でだけ算入されていた）。受験状態も同じ行から取れるので、
  //  見込→欠測の判定に別途 status のプリロードを持たない。
  const examDataCache = new Map<string, ExamDataCache>()

  for (const examId of examIds) {
    const [examStudentRows, examPages] = await Promise.all([
      prisma.examStudent.findMany({
        where: { examId },
        select: {
          id: true,
          studentId: true,
          status: true,
          questionScores: {
            select: {
              id: true,
              examStudentId: true,
              cropRegionId: true,
              status: true,
              partialScore: true,
              updatedAt: true,
            },
          },
          scoreDecisions: {
            select: {
              examStudentId: true,
              cropRegionId: true,
              verdict: true,
              score: true,
              decidedAt: true,
              sourceQuestionScoreId: true,
            },
          },
        },
      }),
      prisma.examPage.findMany({
        where: { examId: examId },
        include: { cropRegions: true },
      }),
    ])
    const cropRegions = examPages.flatMap((examPage) => examPage.cropRegions)

    examDataCache.set(examId, {
      examStudents: examStudentRows.map((examStudentRow) => {
        // 受験者×設問ごとに有効スコア1件へ解決（確定 > 提案合意 > 競合）
        const { resolved: resolvedScores } = resolveEffectiveScores(
          examStudentRow.questionScores,
          examStudentRow.scoreDecisions
        )
        return {
          examStudentId: examStudentRow.id,
          studentId: examStudentRow.studentId,
          status: examStudentRow.status,
          questionScores: resolvedScores.map((resolvedScore) => ({
            examStudentId: resolvedScore.examStudentId,
            cropRegionId: resolvedScore.cropRegionId,
            status: resolvedScore.status,
            partialScore: resolvedScore.partialScore,
          })),
        }
      }),
      cropRegions: cropRegions.map((cropRegion) => ({
        id: cropRegion.id,
        type: cropRegion.type,
        points: cropRegion.points,
      })),
    })
  }

  // 満点は元データ（設問配点 / 評価項目満点）からライブ算出する。
  // GradeDataSource.maxScore 列のスナップショットは使わない（元データ追従）。
  // 生徒ループの外で1ソース1回だけ算出してマップ化する。
  const liveMaxScoreMap = new Map<string, number>()
  for (const dataSource of allDataSources) {
    liveMaxScoreMap.set(dataSource.id, await computeLiveMaxScore(dataSource))
  }

  // DataSource情報をまとめる（推定で使用）
  const dataSourceInfos: DataSourceInfo[] = allDataSources.map((dataSource) => {
    const sourceIds = dataSource.estimationSources.map(
      (estimationSource) => estimationSource.sourceDataSourceId
    )
    return {
      id: dataSource.id,
      name: dataSource.name,
      maxScore: liveMaxScoreMap.get(dataSource.id) ?? 0,
      absentMethod: (dataSource.absentMethod ?? "null") as AbsentMethod,
      absentRatio: Number(dataSource.absentRatio ?? 1),
      absentOffset: Number(dataSource.absentOffset ?? 0),
      estimationMode: dataSource.estimationMode ?? "all",
      estimationSourceIds: sourceIds,
    }
  })

  // データソース id → 実体。素点行列のセルへ列の実体を同梱するために引く
  const dataSourceInfoById = new Map(
    dataSourceInfos.map((dataSourceInfo) => [dataSourceInfo.id, dataSourceInfo])
  )

  // subtotal 型ソースの設問割り当ては生徒に依らないので、素点収集の前に1回だけ引く。
  // 以前は生徒×ソースのループ内で引いており、対象者数×ソース数のクエリが飛んでいた。
  const questionAssignments = await getQuestionAssignmentsBySubtotalIds(
    allDataSources.flatMap((dataSource) =>
      dataSource.type === "subtotal" && dataSource.subtotalId
        ? [dataSource.subtotalId]
        : []
    )
  )

  // === パス1: 全対象者 × 全DataSourceの rawScore を収集して素点行列を組む ===
  const rawScoreRows: RawScoreRow[] = []

  for (const gradeStudent of gradeStudents) {
    const cells: RawScoreCell[] = []
    for (const dataSource of allDataSources) {
      let raw = getRawScore(
        gradeStudent.studentId,
        dataSource,
        examDataCache,
        questionAssignments
      )

      // 見込→欠測対応: treatExpectedAsMissing が true かつ
      // その試験の ExamStudent.status === "expected" → null扱い
      if (
        raw !== null &&
        dataSource.treatExpectedAsMissing &&
        dataSource.examId
      ) {
        const examStudentScores = findExamStudentScores(
          gradeStudent.studentId,
          dataSource.examId,
          examDataCache
        )
        if (examStudentScores?.status === "expected") {
          raw = null
        }
      }

      const dataSourceInfo = dataSourceInfoById.get(dataSource.id)
      if (dataSourceInfo)
        cells.push({ dataSource: dataSourceInfo, rawScore: raw })
    }
    rawScoreRows.push({ gradeStudent, cells })
  }

  return {
    grade,
    classroomIds,
    liveMaxScoreMap,
    dataSourceInfos,
    rawScoreMatrix: new RawScoreMatrix(rawScoreRows),
    allDataSources,
  }
}

/**
 * 構造的兄弟ソースの同定キー。同一試験（examId）または同一資料（courseworkId）に属する
 * ソースは「合計＝小計の和」等の定義上の従属関係を持つ。生徒がその試験/資料を欠席すると
 * 兄弟も同時に欠測するため、モデル適合度 R の説明変数からは除外する（復元でなく予測のRを出す）。
 * グループに属さないソースは自身の id を返し、他と兄弟にならない。
 */
function siblingGroupKey(dataSource: {
  id: string
  examId: string | null
  coursework: { id: string } | null
  courseworkItem: { courseworkId: string } | null
}): string {
  if (dataSource.examId) return `exam:${dataSource.examId}`
  if (dataSource.coursework) return `cw:${dataSource.coursework.id}`
  if (dataSource.courseworkItem) {
    return `cw:${dataSource.courseworkItem.courseworkId}`
  }
  return `self:${dataSource.id}`
}

/**
 * 各データソースの「モデル適合度 R」を保存済みの推定ソース設定で算出する。
 * 手法選択（03-データソース）画面で「このソースが他ソースからどれだけ当てられるか」を示す。
 * R は手法に依らないデータ側の予測しやすさ＝重回帰の縮小率で、
 * 高いほど重回帰でも中心へ寄りにくい（順位法・標準偏差法は縮小そのものを避ける）。
 * @returns 各 dataSourceId → { correlation, sampleSize }（算出不能なソースは null）
 */
export async function computeSourceFits(gradeId: string): Promise<{
  success: boolean
  fits?: Record<string, { correlation: number; sampleSize: number } | null>
  error?: string
}> {
  try {
    const context = await buildGradeCalcContext(gradeId)
    if (!context) {
      return { success: false, error: "Grade exam not found" }
    }
    const { dataSourceInfos, rawScoreMatrix, allDataSources } = context

    // 構造的兄弟（同一試験/資料）の同定キー。R算出時に説明変数から除外する。
    const groupKeyById = new Map<string, string>()
    for (const dataSource of allDataSources) {
      groupKeyById.set(dataSource.id, siblingGroupKey(dataSource))
    }

    const fits: Record<
      string,
      { correlation: number; sampleSize: number } | null
    > = {}
    for (const dataSourceInfo of dataSourceInfos) {
      const targetGroupKey = groupKeyById.get(dataSourceInfo.id)
      // 推定ソース: selected なら指定ID、all なら自ソース以外。満点0（算出ソース無し）は常に除く。
      // さらに両モードとも構造的兄弟（同一試験/資料）を除外する。合計=観点の和 等の派生関係は
      // R=1（＝予測ではなく復元）を生み現実の予測精度を表さないため。
      //
      // これは実際の推定挙動とも整合する: 生徒が試験を丸ごと欠席すると兄弟（同一試験の他観点/合計）も
      // 同時に欠測し、estimateByRegression の availablePredictors から自動的に外れる。合計・観点は
      // 派生値なので「兄弟だけ在る partial 欠測」は起きず、Rと推定が乖離するケースは生じない。
      // selected で兄弟のみ選んだ退化構成では R=算出不能 になるが、その構成では実推定も兄弟を使えず
      // average へ落ちるため、算出不能の表示は誠実（レビュー指摘#1への回答）。
      const predictors = (
        dataSourceInfo.estimationMode === "selected"
          ? dataSourceInfos.filter((candidate) =>
              dataSourceInfo.estimationSourceIds.includes(candidate.id)
            )
          : dataSourceInfos.filter(
              (candidate) => candidate.id !== dataSourceInfo.id
            )
      )
        .filter((candidate) => candidate.maxScore > 0)
        .filter(
          (candidate) => groupKeyById.get(candidate.id) !== targetGroupKey
        )

      fits[dataSourceInfo.id] = computeSourceFit(
        dataSourceInfo,
        predictors,
        rawScoreMatrix
      )
    }
    return { success: true, fits }
  } catch (error) {
    console.error("Error computing source fits:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

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
): Promise<{
  success: boolean
  result?: GradeCalculationResult
  error?: string
}> {
  const applyFrozen = options?.applyFrozen ?? true
  try {
    // 素点行列と付随データ（推定に必要な文脈）をまとめて構築。
    // computeSourceFits（手法選択画面のモデル適合度R）と共有する（SSOT）。
    const context = await buildGradeCalcContext(gradeId)
    if (!context) {
      return { success: false, error: "Grade exam not found" }
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
          const absentMethod = (dataSource.absentMethod ??
            "null") as AbsentMethod
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
              ? findCourseworkStudentScore(
                  student.id,
                  dataSource.courseworkItem
                )
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
      success: true,
      result: {
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
                Number(boundaryB.minPercentage) -
                Number(boundaryA.minPercentage)
            )
            .map((boundary) => ({
              label: boundary.label,
              minPercentage: Number(boundary.minPercentage),
              order: boundary.order,
            })),
        })),
        students,
      },
    }
  } catch (error) {
    console.error("Error calculating grades:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 当該データソース（テスト）を実測した全生徒の素点分布（平均・母標準偏差）を算出する。
 * 実測値（rawScoreMap の非null）のみを母数とし、欠席（null）は含めない。閲覧生徒も含めた
 * クラスの実測分布なので、どの生徒の内訳popoverでも同一値になる（＝表示ラベルと一致）。
 * 標準偏差算出のため2名以上を要する。ソース単位で一定のため生徒ループの外で1回だけ呼ぶ。
 *
 * 注: 標準偏差法・順位法の載せ替えで使う absentEstimation.collectTargetDistribution とは
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
