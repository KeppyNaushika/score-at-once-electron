/**
 * 成績算出エンジン
 * GradeItem × DataSource ベースで観点別・総合成績を算出
 * 欠測時の代替スコア推定（average / regression / zero）に対応
 */

import type {
  AbsentMethod,
  GradeCalculationResult,
  GradeItemResult,
  SourceScoreResult,
  StudentGradeResult,
} from "../../../../src/types/grade.types"
import prisma from "../../prisma/client"
import { computeLiveMaxScore } from "../../prisma/gradeDataSource"
import { calculateActualScore } from "../../prisma/questionScore"
import { resolveEffectiveScores } from "./scoreResolution"
import {
  calculateSubtotalScoreBySubtotalId,
  type QuestionScoreData,
} from "./subtotalCalculator"

interface ExamDataCache {
  questionScores: QuestionScoreData[]
  cropRegions: { id: string; type: string; points: number | null }[]
}

interface DataSourceInfo {
  id: string
  maxScore: number
  absentMethod: AbsentMethod
  absentRatio: number
  absentOffset: number
  estimationMode: string
  estimationSourceIds: string[]
}

/**
 * 成績を算出する
 */
export async function calculateGrades(gradeId: string): Promise<{
  success: boolean
  result?: GradeCalculationResult
  error?: string
}> {
  try {
    // 1. Grade + リレーションを取得
    const gp = await prisma.grade.findUnique({
      where: { id: gradeId },
      include: {
        gradeClasses: {
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
                courseworkItem: {
                  include: {
                    scores: true,
                    letterScales: { orderBy: { order: "asc" } },
                  },
                },
                coursework: {
                  include: {
                    items: {
                      include: {
                        scores: true,
                        letterScales: { orderBy: { order: "asc" } },
                      },
                    },
                  },
                },
              },
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
        boundarySets: {
          include: { boundaries: { orderBy: { order: "asc" } } },
        },
      },
    })

    if (!gp) {
      return { success: false, error: "Grade exam not found" }
    }

    // 2. 試験の登録生徒一覧を取得
    const examStudents = await prisma.gradeStudent.findMany({
      where: { gradeId },
      include: {
        student: {
          include: {
            memberships: {
              include: { classroom: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: [{ customOrder: "asc" }, { createdAt: "asc" }],
    })

    const classIds = gp.gradeClasses.map((c) => c.classroomId)

    // 3. 上書きデータを取得
    const overrides = await prisma.gradeOverride.findMany({
      where: { gradeId },
    })
    const overrideMap = new Map<string, string>()
    for (const ov of overrides) {
      const key = `${ov.studentId}:${ov.targetType}:${ov.gradeItemId ?? "__overall__"}`
      overrideMap.set(key, ov.overrideLabel)
    }

    // 3.5. 除外データを取得
    const exclusions = await prisma.gradeItemExclusion.findMany({
      where: { gradeId },
    })
    const exclusionSet = new Set(
      exclusions.map((ex) => `${ex.studentId}:${ex.gradeItemId}`)
    )

    // 4. 全DataSourceから使用される試験試験IDを収集
    const allDataSources = gp.gradeItems.flatMap((gi) => gi.dataSources)
    const examIds = [
      ...new Set(
        allDataSources
          .filter(
            (ds) =>
              (ds.type === "exam_total" ||
                ds.type === "subtotal" ||
                ds.type === "crop_region") &&
              ds.examId
          )
          .map((ds) => ds.examId!)
      ),
    ]

    // 5. 試験試験のスコアデータを事前取得
    const examDataCache = new Map<string, ExamDataCache>()

    for (const examId of examIds) {
      const [questionScores, scoreDecisions, examPages] = await Promise.all([
        prisma.questionScore.findMany({
          where: { cropRegion: { examPage: { examId: examId } } },
          select: {
            id: true,
            studentId: true,
            cropRegionId: true,
            status: true,
            partialScore: true,
            updatedAt: true,
          },
        }),
        prisma.scoreDecision.findMany({
          where: { cropRegion: { examPage: { examId: examId } } },
          select: {
            studentId: true,
            cropRegionId: true,
            verdict: true,
            score: true,
            decidedAt: true,
            sourceQuestionScoreId: true,
          },
        }),
        prisma.examPage.findMany({
          where: { examId: examId },
          include: { cropRegions: true },
        }),
      ])
      const cropRegions = examPages.flatMap((pp) => pp.cropRegions)
      // 生徒×設問ごとに有効スコア1件へ解決（確定 > 提案合意 > 競合）
      const { resolved: resolvedScores } = resolveEffectiveScores(
        questionScores,
        scoreDecisions
      )
      examDataCache.set(examId, {
        questionScores: resolvedScores.map((qs) => ({
          studentId: qs.studentId,
          cropRegionId: qs.cropRegionId,
          status: qs.status,
          partialScore: qs.partialScore,
        })),
        cropRegions: cropRegions.map((cr) => ({
          id: cr.id,
          type: cr.type,
          points: cr.points,
        })),
      })
    }

    // 5.5. 見込→欠測対応: examIdごとのExamStudent状態をプリロード
    // Map<examId, Map<studentId, status>>
    const examExamStudentStatusMap = new Map<string, Map<string, string>>()
    for (const examId of examIds) {
      const ps = await prisma.examStudent.findMany({
        where: { examId: examId },
        select: { studentId: true, status: true },
      })
      const statusMap = new Map<string, string>()
      for (const p of ps) {
        statusMap.set(p.studentId, p.status)
      }
      examExamStudentStatusMap.set(examId, statusMap)
    }

    // 満点は元データ（設問配点 / 評価項目満点）からライブ算出する。
    // GradeDataSource.maxScore 列のスナップショットは使わない（元データ追従）。
    // 生徒ループの外で1ソース1回だけ算出してマップ化する。
    const liveMaxScoreMap = new Map<string, number>()
    for (const ds of allDataSources) {
      liveMaxScoreMap.set(ds.id, await computeLiveMaxScore(ds))
    }

    // DataSource情報をまとめる（推定で使用）
    const dataSourceInfos: DataSourceInfo[] = allDataSources.map((ds) => {
      let sourceIds: string[] = []
      if (typeof ds.estimationSourceIds === "string") {
        try {
          sourceIds = JSON.parse(ds.estimationSourceIds)
        } catch {
          sourceIds = []
        }
      }
      return {
        id: ds.id,
        maxScore: liveMaxScoreMap.get(ds.id) ?? 0,
        absentMethod: (ds.absentMethod ?? "null") as AbsentMethod,
        absentRatio: Number(ds.absentRatio ?? 1),
        absentOffset: Number(ds.absentOffset ?? 0),
        estimationMode: ds.estimationMode ?? "all",
        estimationSourceIds: sourceIds,
      }
    })

    // === パス1: 全生徒 × 全DataSourceの rawScore を収集 ===
    // Map<studentId, Map<dataSourceId, number | null>>
    const rawScoreMap = new Map<string, Map<string, number | null>>()

    for (const ps of examStudents) {
      const studentScores = new Map<string, number | null>()
      for (const ds of allDataSources) {
        let raw = await getRawScore(ps.student.id, ds, examDataCache)

        // 見込→欠測対応: treatExpectedAsMissing が true かつ
        // 試験試験の ExamStudent.status === "EXPECTED" → null扱い
        if (raw !== null && ds.treatExpectedAsMissing && ds.examId) {
          const statusMap = examExamStudentStatusMap.get(ds.examId)
          if (statusMap?.get(ps.student.id) === "EXPECTED") {
            raw = null
          }
        }

        studentScores.set(ds.id, raw)
      }
      rawScoreMap.set(ps.student.id, studentScores)
    }

    // === パス2: 推定 + 重み付け ===
    const students: StudentGradeResult[] = []

    for (const ps of examStudents) {
      const student = ps.student
      const membership = student.memberships.find((m) =>
        classIds.includes(m.classroomId)
      )
      const gradeItemResults: GradeItemResult[] = []

      for (const gradeItem of gp.gradeItems) {
        // 除外チェック
        if (exclusionSet.has(`${student.id}:${gradeItem.id}`)) {
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
          })
          continue
        }

        const sourceScores: SourceScoreResult[] = []

        for (const ds of gradeItem.dataSources) {
          // 満点は元データからライブ算出した値を使う（maxScore列は使わない）
          const maxScore = liveMaxScoreMap.get(ds.id) ?? 0
          const weight = Number(ds.weight)
          const absentMethod = (ds.absentMethod ?? "null") as AbsentMethod
          const absentRatio = Number(ds.absentRatio ?? 1)
          const absentOffset = Number(ds.absentOffset ?? 0)

          const dsInfo = dataSourceInfos.find((d) => d.id === ds.id)

          const studentScores = rawScoreMap.get(student.id)
          let rawScore = studentScores?.get(ds.id) ?? null
          let isEstimated = false

          // rawScoreがnullかつ推定設定がある場合、代替スコアを算出
          if (rawScore === null && absentMethod !== "null") {
            // ソース選択対応: estimationMode === "selected" の場合、指定IDのみ使用
            const sourcesToUse =
              dsInfo?.estimationMode === "selected"
                ? dataSourceInfos.filter((d) =>
                    dsInfo.estimationSourceIds.includes(d.id)
                  )
                : dataSourceInfos

            const estimated = estimateAbsentScore(
              absentMethod,
              student.id,
              ds.id,
              maxScore,
              rawScoreMap,
              sourcesToUse
            )
            if (estimated !== null) {
              // 調整 + クランプ
              rawScore = applyAdjustmentAndClamp(
                estimated,
                absentRatio,
                absentOffset,
                maxScore
              )
              isEstimated = true
            }
          }

          const weightedScore =
            rawScore !== null && maxScore > 0
              ? (rawScore / maxScore) * weight
              : null

          // coursework型: 入力された評価記号・加減点・コメントを結果に添付
          const courseworkScore =
            ds.type === "coursework"
              ? ds.courseworkItem?.scores.find(
                  (s) => s.studentId === student.id
                )
              : undefined

          sourceScores.push({
            dataSourceId: ds.id,
            dataSourceName: ds.name,
            type: ds.type,
            rawScore,
            maxScore,
            weight,
            weightedScore,
            isEstimated,
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
          (s) => s.weightedScore !== null
        )

        let weightedMax: number
        let weightedScore: number | null

        let isAllMissing = false

        if (nonNullSources.length > 0) {
          weightedMax = nonNullSources.reduce((sum, s) => sum + s.weight, 0)
          weightedScore = nonNullSources.reduce(
            (sum, s) => sum + s.weightedScore!,
            0
          )
        } else if (sourceScores.length > 0) {
          // 全スコアがnull → 換算合計0点として扱う
          weightedMax = sourceScores.reduce((sum, s) => sum + s.weight, 0)
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

        // 境界セットからラベルを決定
        const boundarySet = gp.boundarySets.find(
          (bs) =>
            bs.targetType === "grade_item" && bs.gradeItemId === gradeItem.id
        )
        const originalGradeLabel = determineGradeLabel(
          percentage,
          boundarySet?.boundaries ?? []
        )
        const itemOverrideKey = `${student.id}:grade_item:${gradeItem.id}`
        const overrideGradeLabel = overrideMap.get(itemOverrideKey) ?? null

        gradeItemResults.push({
          gradeItemId: gradeItem.id,
          gradeItemName: gradeItem.name,
          isExcluded: false,
          isAllMissing,
          sourceScores,
          weightedScore,
          weightedMaxScore: weightedMax,
          percentage,
          gradeLabel: overrideGradeLabel ?? originalGradeLabel,
          originalGradeLabel,
          overrideGradeLabel,
        })
      }

      // 総合スコア（除外・欠点のGradeItemは分母・分子から除外）
      const includedResults = gradeItemResults.filter((gi) => !gi.isExcluded)
      const nonNullItems = includedResults.filter(
        (gi) => gi.weightedScore !== null
      )
      const overallMaxScore = nonNullItems.reduce(
        (sum, gi) => sum + gi.weightedMaxScore,
        0
      )
      const overallScore =
        nonNullItems.length > 0
          ? nonNullItems.reduce((sum, gi) => sum + gi.weightedScore!, 0)
          : null
      const overallPercentage =
        overallScore !== null && overallMaxScore > 0
          ? (overallScore / overallMaxScore) * 100
          : null

      const overallBoundarySet = gp.boundarySets.find(
        (bs) => bs.targetType === "overall"
      )
      const originalOverallGradeLabel = determineGradeLabel(
        overallPercentage,
        overallBoundarySet?.boundaries ?? []
      )
      const overallOverrideKey = `${student.id}:overall:__overall__`
      const overrideOverallGradeLabel =
        overrideMap.get(overallOverrideKey) ?? null

      students.push({
        studentId: student.id,
        studentNumber: student.studentNumber,
        lastName: student.lastName,
        firstName: student.firstName,
        attendanceNumber: membership?.attendanceNumber ?? null,
        className: membership?.classroom.name ?? null,
        gradeItemResults,
        overallScore,
        overallMaxScore,
        overallPercentage,
        overallGradeLabel:
          overrideOverallGradeLabel ?? originalOverallGradeLabel,
        originalOverallGradeLabel,
        overrideOverallGradeLabel,
      })
    }

    return {
      success: true,
      result: {
        gradeId: gp.id,
        gradeName: gp.name,
        classNames: gp.gradeClasses.map((c) => c.classroom.name),
        gradeItems: gp.gradeItems.map((gi) => ({
          id: gi.id,
          name: gi.name,
          order: gi.order,
        })),
        students,
        boundarySets: gp.boundarySets.map((bs) => ({
          targetType: bs.targetType,
          gradeItemId: bs.gradeItemId,
          boundaries: [...bs.boundaries]
            .sort((a, b) => Number(b.minPercentage) - Number(a.minPercentage))
            .map((b) => ({
              label: b.label,
              minPercentage: Number(b.minPercentage),
            })),
        })),
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
 * DataSourceからrawScoreを取得（推定前の実スコア）
 */
async function getRawScore(
  studentId: string,
  ds: {
    type: string
    examId: string | null
    subtotalId: string | null
    cropRegionId: string | null
    courseworkItem?: {
      maxScore: unknown
      inputMode: string
      scores: {
        studentId: string
        score: unknown
        letterValue?: string | null
        adjustment?: unknown
      }[]
      letterScales: { label: string; score: unknown }[]
    } | null
    coursework?: {
      items: {
        maxScore: unknown
        inputMode: string
        scores: {
          studentId: string
          score: unknown
          letterValue?: string | null
          adjustment?: unknown
        }[]
        letterScales: { label: string; score: unknown }[]
      }[]
    } | null
  },
  examDataCache: Map<string, ExamDataCache>
): Promise<number | null> {
  if (ds.type === "exam_total" && ds.examId) {
    return calculateExamTotalScore(studentId, ds.examId, examDataCache)
  } else if (ds.type === "subtotal" && ds.subtotalId && ds.examId) {
    const examData = examDataCache.get(ds.examId)
    if (examData) {
      const result = await calculateSubtotalScoreBySubtotalId(
        studentId,
        ds.subtotalId,
        examData.questionScores,
        examData.cropRegions as Parameters<
          typeof calculateSubtotalScoreBySubtotalId
        >[3]
      )
      return result.score
    }
  } else if (ds.type === "crop_region" && ds.cropRegionId && ds.examId) {
    return calculateCropRegionScore(
      studentId,
      ds.cropRegionId,
      ds.examId,
      examDataCache
    )
  } else if (ds.type === "coursework" && ds.courseworkItem) {
    return getCourseworkRawScore(studentId, ds.courseworkItem)
  } else if (ds.type === "coursework_total" && ds.coursework) {
    return getCourseworkTotalRawScore(studentId, ds.coursework.items)
  }
  return null
}

/**
 * coursework_total型データソース（試験外成績資料の全評価項目合計）の実スコアを算出する。
 * 各評価項目のスコアを getCourseworkRawScore で求めて合算する。
 * exam_total と同様、採点済み項目のみを合算し、全項目が未入力なら null を返す。
 */
function getCourseworkTotalRawScore(
  studentId: string,
  items: {
    maxScore: unknown
    inputMode: string
    scores: {
      studentId: string
      score: unknown
      letterValue?: string | null
      adjustment?: unknown
    }[]
    letterScales: { label: string; score: unknown }[]
  }[]
): number | null {
  let total = 0
  let hasScored = false
  for (const item of items) {
    const score = getCourseworkRawScore(studentId, item)
    if (score !== null) {
      hasScored = true
      total += score
    }
  }
  return hasScored ? total : null
}

/**
 * coursework型データソース（試験外成績資料の評価項目）の実スコアを算出する。
 * - letterモード: 入力された評価記号を変換表で点数化
 * - numericモード: 入力された数値をそのまま使用
 * いずれも加点・減点(adjustment)を加算し、結果はクランプしない。
 * 実際に入力された得点は配点超え（100%超）も負値（減点で0未満）もそのまま反映する。
 * （推定で算出した代替スコアは別途 applyAdjustmentAndClamp で [0, 満点] に収める。
 * 実入力と推定値で扱いを分け、推定値だけが配点を超えないようにするため。）
 * 満点は評価項目（CourseworkItem.maxScore）を live 参照する。
 */
function getCourseworkRawScore(
  studentId: string,
  item: {
    maxScore: unknown
    inputMode: string
    scores: {
      studentId: string
      score: unknown
      letterValue?: string | null
      adjustment?: unknown
    }[]
    letterScales: { label: string; score: unknown }[]
  }
): number | null {
  const cs = item.scores.find((s) => s.studentId === studentId)
  if (!cs) return null

  // 基準スコア（変換前・加減点前）を決定
  let base: number | null
  if (item.inputMode === "letter") {
    if (cs.letterValue === null || cs.letterValue === undefined) {
      base = null
    } else {
      const scale = item.letterScales.find((ls) => ls.label === cs.letterValue)
      base = scale ? Number(scale.score) : null
    }
  } else {
    base = cs.score !== null && cs.score !== undefined ? Number(cs.score) : null
  }

  if (base === null || Number.isNaN(base)) return null

  const adjustment =
    cs.adjustment !== null && cs.adjustment !== undefined
      ? Number(cs.adjustment)
      : 0
  // クランプしない。配点超え・負値のいずれも入力どおり成績算出に反映する。
  return base + adjustment
}

/**
 * 欠測時の代替スコアを推定
 * rawScoreMapには推定前の実スコアのみが格納されている（循環推定の防止）
 */
export function estimateAbsentScore(
  method: AbsentMethod,
  studentId: string,
  dataSourceId: string,
  maxScore: number,
  rawScoreMap: Map<string, Map<string, number | null>>,
  allDataSources: DataSourceInfo[]
): number | null {
  if (method === "zero") {
    return 0
  }
  if (method === "average") {
    return estimateByAverage(
      studentId,
      dataSourceId,
      maxScore,
      rawScoreMap,
      allDataSources
    )
  }
  if (method === "regression") {
    return estimateByRegression(
      studentId,
      dataSourceId,
      maxScore,
      rawScoreMap,
      allDataSources
    )
  }
  return null
}

/**
 * 平均比率推定: 同じ生徒の他DataSourceのスコア比率(score/maxScore)を平均
 * → 平均比率 × 当該DataSource.maxScore
 */
function estimateByAverage(
  studentId: string,
  dataSourceId: string,
  maxScore: number,
  rawScoreMap: Map<string, Map<string, number | null>>,
  allDataSources: DataSourceInfo[]
): number | null {
  const studentScores = rawScoreMap.get(studentId)
  if (!studentScores) return null

  let ratioSum = 0
  let ratioCount = 0

  for (const ds of allDataSources) {
    if (ds.id === dataSourceId) continue
    if (ds.maxScore <= 0) continue
    const score = studentScores.get(ds.id)
    if (score === null || score === undefined) continue
    ratioSum += score / ds.maxScore
    ratioCount++
  }

  if (ratioCount === 0) return null
  const avgRatio = ratioSum / ratioCount
  return clamp(avgRatio * maxScore, 0, maxScore)
}

/**
 * OLS重回帰法推定:
 * 他の生徒のデータを訓練データとして、他DataSourceスコアから
 * 当該DataSourceスコアを予測する重回帰モデルを構築。
 * β = (X^T X)^(-1) X^T Y で係数を算出し、対象生徒のスコアを予測。
 */
function estimateByRegression(
  studentId: string,
  dataSourceId: string,
  maxScore: number,
  rawScoreMap: Map<string, Map<string, number | null>>,
  allDataSources: DataSourceInfo[]
): number | null {
  // 他DataSourceのID一覧（predictor変数）
  const predictorDsIds = allDataSources
    .filter((ds) => ds.id !== dataSourceId && ds.maxScore > 0)
    .map((ds) => ds.id)

  if (predictorDsIds.length === 0) return null

  // 対象生徒のpredictor値を取得
  const targetStudentScores = rawScoreMap.get(studentId)
  if (!targetStudentScores) return null

  // 対象生徒が持っているpredictorのみを使用
  const availablePredictors = predictorDsIds.filter((id) => {
    const s = targetStudentScores.get(id)
    return s !== null && s !== undefined
  })

  if (availablePredictors.length === 0) return null

  // 訓練データ収集: 他の生徒で、当該DSと全available predictorのスコアが揃っている行
  const X: number[][] = [] // 各行 = [1, x1, x2, ...] (切片含む)
  const Y: number[] = []

  for (const [sid, scores] of rawScoreMap) {
    if (sid === studentId) continue
    const y = scores.get(dataSourceId)
    if (y === null || y === undefined) continue

    const row: number[] = [1] // 切片項
    let complete = true
    for (const predId of availablePredictors) {
      const x = scores.get(predId)
      if (x === null || x === undefined) {
        complete = false
        break
      }
      row.push(x)
    }
    if (!complete) continue

    X.push(row)
    Y.push(y)
  }

  // 最低でも説明変数+1のサンプルが必要（＋余裕を持って）
  const minSamples = availablePredictors.length + 2
  if (X.length < minSamples) {
    // サンプル不足の場合、平均比率法にフォールバック
    return estimateByAverage(
      studentId,
      dataSourceId,
      maxScore,
      rawScoreMap,
      allDataSources
    )
  }

  // OLS: β = (X^T X)^(-1) X^T Y
  const p = X[0].length // パラメータ数（切片含む）
  const beta = solveOLS(X, Y, p)
  if (!beta) {
    // 特異行列の場合、平均比率法にフォールバック
    return estimateByAverage(
      studentId,
      dataSourceId,
      maxScore,
      rawScoreMap,
      allDataSources
    )
  }

  // 対象生徒のpredictor値で予測
  const xTarget = [1]
  for (const predId of availablePredictors) {
    xTarget.push(targetStudentScores.get(predId)!)
  }

  let predicted = 0
  for (let j = 0; j < p; j++) {
    predicted += beta[j] * xTarget[j]
  }

  return clamp(predicted, 0, maxScore)
}

/**
 * OLS正規方程式を解く: β = (X^T X)^(-1) X^T Y
 * ガウス消去法で (X^T X) β = X^T Y を解く
 */
function solveOLS(X: number[][], Y: number[], p: number): number[] | null {
  const n = X.length

  // X^T X (p×p)
  const XtX: number[][] = Array.from({ length: p }, () => Array(p).fill(0))
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j]
      }
      XtX[i][j] = sum
    }
  }

  // X^T Y (p)
  const XtY: number[] = Array(p).fill(0)
  for (let i = 0; i < p; i++) {
    let sum = 0
    for (let k = 0; k < n; k++) {
      sum += X[k][i] * Y[k]
    }
    XtY[i] = sum
  }

  // 拡大係数行列 [XtX | XtY] → ガウス消去法
  const aug: number[][] = XtX.map((row, i) => [...row, XtY[i]])

  for (let col = 0; col < p; col++) {
    // ピボット選択
    let maxRow = col
    let maxVal = Math.abs(aug[col][col])
    for (let row = col + 1; row < p; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col])
        maxRow = row
      }
    }
    if (maxVal < 1e-12) return null // 特異行列

    // 行交換
    if (maxRow !== col) {
      ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
    }

    // 前進消去
    const pivot = aug[col][col]
    for (let row = col + 1; row < p; row++) {
      const factor = aug[row][col] / pivot
      for (let j = col; j <= p; j++) {
        aug[row][j] -= factor * aug[col][j]
      }
    }
  }

  // 後退代入
  const beta = Array(p).fill(0)
  for (let i = p - 1; i >= 0; i--) {
    if (Math.abs(aug[i][i]) < 1e-12) return null
    let sum = aug[i][p]
    for (let j = i + 1; j < p; j++) {
      sum -= aug[i][j] * beta[j]
    }
    beta[i] = sum / aug[i][i]
  }

  return beta
}

/**
 * 調整(ratio/offset)を適用し、[0, maxScore]にクランプ
 */
export function applyAdjustmentAndClamp(
  estimated: number,
  ratio: number,
  offset: number,
  maxScore: number
): number {
  const adjusted = estimated * ratio + offset
  return Math.round(clamp(adjusted, 0, maxScore) * 100) / 100
}

/**
 * 値を[min, max]範囲にクランプ
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * exam_total: 試験の全QUESTION_ANSWER CropRegionスコア合計
 */
function calculateExamTotalScore(
  studentId: string,
  examId: string,
  examDataCache: Map<string, ExamDataCache>
): number | null {
  const examData = examDataCache.get(examId)
  if (!examData) return null

  const studentScores = examData.questionScores.filter(
    (qs) => qs.studentId === studentId
  )
  const questionRegions = examData.cropRegions.filter(
    (cr) => cr.type === "QUESTION_ANSWER"
  )

  let totalScore = 0
  let hasScored = false

  for (const cr of questionRegions) {
    const scoreData = studentScores.find((s) => s.cropRegionId === cr.id)
    if (scoreData) {
      const actualScore = calculateActualScore(scoreData, cr.points ?? 0)
      if (actualScore !== null) {
        hasScored = true
        totalScore += actualScore
      }
    }
  }

  return hasScored ? totalScore : null
}

/**
 * crop_region: 単一CropRegionのスコア取得
 */
function calculateCropRegionScore(
  studentId: string,
  cropRegionId: string,
  examId: string,
  examDataCache: Map<string, ExamDataCache>
): number | null {
  const examData = examDataCache.get(examId)
  if (!examData) return null

  const cropRegion = examData.cropRegions.find((cr) => cr.id === cropRegionId)
  if (!cropRegion) return null

  const scoreData = examData.questionScores.find(
    (qs) => qs.studentId === studentId && qs.cropRegionId === cropRegionId
  )
  if (!scoreData) return null

  return calculateActualScore(scoreData, cropRegion.points ?? 0)
}

/**
 * パーセンテージから成績ラベルを決定（降順マッチ）
 */
function determineGradeLabel(
  percentage: number | null,
  boundaries: { label: string; minPercentage: unknown; order: number }[]
): string | null {
  if (percentage === null || boundaries.length === 0) return null

  const sorted = [...boundaries].sort(
    (a, b) => Number(b.minPercentage) - Number(a.minPercentage)
  )

  for (const boundary of sorted) {
    if (percentage >= Number(boundary.minPercentage)) {
      return boundary.label
    }
  }
  return sorted[sorted.length - 1]?.label ?? null
}
