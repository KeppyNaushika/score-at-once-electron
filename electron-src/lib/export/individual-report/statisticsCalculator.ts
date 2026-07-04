/**
 * 個人成績表用統計計算ロジック
 */

import type { StudentStatus } from "@/types/studentStatus.types"

import {
  average as calculateAverage,
  boxPlot as calculateBoxPlotData,
  rank as calculateRank,
  stdDev as calculateStdDev,
} from "../../shared/calculations/numericStats"
import type {
  DiscriminationLevel,
  ScoringData,
} from "../../shared/types/exportTypes"
import type {
  ClassStatEntry,
  RawTotalScoreEntry,
  StatisticsData,
  SubtotalRawScores,
  SubtotalStatistics,
} from "./types"

/**
 * 統計算出に渡す学級情報（studentReport 選択学級 ∩ 本人の受験日所属学級）
 */
export interface StudentClassForStats {
  classroomId: string
  className: string
  grade: string | null
  /** 当該学級の受験日所属生徒ID（学級全体が母集団） */
  memberStudentIds: string[]
}

/**
 * studentId → 合計点の索引を構築する。
 * 生徒ごとに calculateStatisticsForStudent を呼ぶ際、呼び出し側で一度だけ構築し
 * 渡すことで O(生徒数^2) の再構築を避ける。
 */
export function buildScoreByStudentId(
  allScoringData: ScoringData[]
): Map<string, number | null> {
  return new Map(
    allScoringData.map((scoringData) => [
      scoringData.studentId,
      scoringData.totalScore,
    ])
  )
}

/**
 * 偏差値を計算
 */
function calculateDeviation(
  score: number,
  average: number,
  stdDev: number
): number {
  if (stdDev === 0) return 50
  return Math.round(((score - average) / stdDev) * 10 + 50)
}

/**
 * 設問別正答率を計算
 */
export function calculateQuestionCorrectRates(
  allScoringData: ScoringData[]
): Record<string, number> {
  const rates: Record<string, number> = {}

  if (allScoringData.length === 0) return rates

  // 最初の生徒から設問リストを取得
  const questionIds = allScoringData[0].scores.map((score) => score.questionId)

  for (const questionId of questionIds) {
    let correctCount = 0
    let totalCount = 0

    for (const scoringData of allScoringData) {
      const score = scoringData.scores.find(
        (questionScore) => questionScore.questionId === questionId
      )
      if (score && score.status !== "unscored") {
        totalCount++
        if (score.status === "correct") {
          correctCount++
        }
      }
    }

    rates[questionId] = totalCount > 0 ? (correctCount / totalCount) * 100 : 0
  }

  return rates
}

/**
 * 設問別得点率を計算
 * 各生徒の得点/配点の平均（部分点を比例的に反映）
 */
export function calculateQuestionScoreRates(
  allScoringData: ScoringData[]
): Record<string, number> {
  const rates: Record<string, number> = {}

  if (allScoringData.length === 0) return rates

  const questionIds = allScoringData[0].scores.map((score) => score.questionId)

  for (const questionId of questionIds) {
    let scoreSum = 0
    let totalCount = 0

    for (const scoringData of allScoringData) {
      const score = scoringData.scores.find(
        (questionScore) => questionScore.questionId === questionId
      )
      if (score && score.status !== "unscored" && score.maxScore > 0) {
        totalCount++
        scoreSum += (score.score ?? 0) / score.maxScore
      }
    }

    rates[questionId] = totalCount > 0 ? (scoreSum / totalCount) * 100 : 0
  }

  return rates
}

/**
 * 小計別統計データを計算
 * SubtotalScoreから直接グループ情報を取得（CropRegion経由のマッピング不要）
 */
export function calculateSubtotalStatistics(
  allScoringData: ScoringData[]
): SubtotalStatistics[] {
  if (
    allScoringData.length === 0 ||
    allScoringData[0].subtotalScores.length === 0
  ) {
    return []
  }

  // 最初の生徒から小計点リストを取得
  const subtotalTemplate = allScoringData[0].subtotalScores

  return subtotalTemplate.map((template) => {
    const scores: number[] = []

    for (const scoringData of allScoringData) {
      const subtotal = scoringData.subtotalScores.find(
        (subtotalScore) => subtotalScore.subtotalId === template.subtotalId
      )
      if (subtotal && subtotal.score !== null) {
        scores.push(subtotal.score)
      }
    }

    return {
      subtotalId: template.subtotalId,
      subtotalLabel: template.subtotalLabel,
      maxScore: template.maxScore,
      average: calculateAverage(scores),
      stdDev: calculateStdDev(scores),
      boxPlot: calculateBoxPlotData(scores),
      subtotalGroupId: template.subtotalGroupId,
      subtotalGroupName: template.subtotalGroupName,
    }
  })
}

/**
 * 小計別生スコアデータを収集（renderer側でのbox plot再計算用）
 * 各小計ごとに全生徒のスコアと受験状態を収集
 */
export function collectSubtotalRawScores(
  allScoringData: ScoringData[]
): SubtotalRawScores[] {
  if (
    allScoringData.length === 0 ||
    allScoringData[0].subtotalScores.length === 0
  ) {
    return []
  }

  // 最初の生徒から小計点リストを取得
  const subtotalTemplate = allScoringData[0].subtotalScores

  return subtotalTemplate.map((template) => {
    const scores = allScoringData
      .map((scoringData) => {
        const subtotal = scoringData.subtotalScores.find(
          (subtotalScore) => subtotalScore.subtotalId === template.subtotalId
        )
        if (!subtotal || subtotal.score === null) return null
        return {
          studentId: scoringData.studentId,
          score: subtotal.score,
          status: scoringData.status || ("participating" as const),
        }
      })
      .filter(
        (
          entry
        ): entry is {
          studentId: string
          score: number
          status: StudentStatus
        } => entry !== null
      )

    return {
      subtotalId: template.subtotalId,
      scores,
    }
  })
}

/**
 * 設問別識別係数（補正済み項目合計相関）を計算
 * corrected item-total correlation: 当該設問を除いた合計点との相関
 */
export function calculateDiscriminationIndices(
  allScoringData: ScoringData[]
): Record<string, number | null> {
  const indices: Record<string, number | null> = {}

  if (allScoringData.length === 0) return indices

  const questionIds = allScoringData[0].scores.map((score) => score.questionId)

  for (const questionId of questionIds) {
    const itemScores: number[] = []
    const correctedTotals: number[] = []

    for (const scoringData of allScoringData) {
      const score = scoringData.scores.find(
        (questionScore) => questionScore.questionId === questionId
      )
      if (
        !score ||
        score.status === "unscored" ||
        scoringData.totalScore === null
      ) {
        continue
      }
      const itemScore = score.score ?? 0
      itemScores.push(itemScore)
      correctedTotals.push(scoringData.totalScore - itemScore)
    }

    if (itemScores.length < 3) {
      indices[questionId] = null
      continue
    }

    const itemStdDev = calculateStdDev(itemScores)
    const totalStdDev = calculateStdDev(correctedTotals)

    if (itemStdDev === 0 || totalStdDev === 0) {
      indices[questionId] = null
      continue
    }

    const itemMean = calculateAverage(itemScores)
    const totalMean = calculateAverage(correctedTotals)
    const n = itemScores.length

    let covariance = 0
    for (let i = 0; i < n; i++) {
      covariance +=
        (itemScores[i] - itemMean) * (correctedTotals[i] - totalMean)
    }
    covariance /= n

    indices[questionId] = covariance / (itemStdDev * totalStdDev)
  }

  return indices
}

/**
 * 識別係数から判定レベルを返す
 */
export function getDiscriminationLevel(r: number | null): DiscriminationLevel {
  if (r === null) return "insufficient"
  if (r < 0) return "negative"
  if (r < 0.2) return "poor"
  if (r < 0.3) return "marginal"
  if (r < 0.4) return "acceptable"
  return "good"
}

/**
 * 特定の生徒の統計データを計算
 *
 * @param studentClasses - studentReport 選択学級 ∩ 本人の受験日所属学級。
 *   各学級全体を母集団として学級平均・順位を算出（複数学級対応）。
 */
export function calculateStatisticsForStudent(
  _studentId: string,
  studentScore: number | null,
  allScoringData: ScoringData[],
  studentClasses: StudentClassForStats[],
  questionCorrectRates: Record<string, number>,
  questionScoreRates: Record<string, number>,
  /**
   * studentId → 合計点の索引（学級母集団の絞り込み用）。生徒ごとに本関数を
   * 呼ぶ呼び出し側で一度だけ構築して渡せば O(生徒数^2) の再構築を避けられる。
   * 省略時は allScoringData から内部構築する（buildScoreByStudentId と同一）。
   */
  scoreByStudentId?: Map<string, number | null>
): StatisticsData {
  // 全体のスコア配列（null を除外）
  const allScores = allScoringData
    .map((scoringData) => scoringData.totalScore)
    .filter((score): score is number => score !== null)

  // 全体統計
  const overallAverage = calculateAverage(allScores)
  const overallStdDev = calculateStdDev(allScores)
  const overallBoxPlot = calculateBoxPlotData(allScores)

  // studentId → 合計点の索引（学級母集団の絞り込み用）
  const scoreById = scoreByStudentId ?? buildScoreByStudentId(allScoringData)

  // 学級別統計（studentReport 選択学級ごと。母集団＝当該学級全体）
  const classes: ClassStatEntry[] = studentClasses.map((classroom) => {
    // allScoringData に存在する所属生徒のみ（在籍はするが採点対象外を除外）
    const presentIds = classroom.memberStudentIds.filter((id) =>
      scoreById.has(id)
    )
    const classScores = presentIds
      .map((id) => scoreById.get(id) ?? null)
      .filter((score): score is number => score !== null)

    return {
      classroomId: classroom.classroomId,
      className: classroom.className,
      grade: classroom.grade,
      memberStudentIds: classroom.memberStudentIds,
      average: calculateAverage(classScores),
      stdDev: calculateStdDev(classScores),
      boxPlot: calculateBoxPlotData(classScores),
      total: presentIds.length,
      rank:
        studentScore !== null ? calculateRank(studentScore, classScores) : 0,
    }
  })

  // 個人統計（studentScore === null の場合は deviation=0, rank=0）
  const deviation =
    studentScore !== null
      ? calculateDeviation(studentScore, overallAverage, overallStdDev)
      : 0
  const overallRank =
    studentScore !== null ? calculateRank(studentScore, allScores) : 0

  // 小計別統計（SubtotalScoreから直接グループ情報を取得）
  const subtotalStatistics = calculateSubtotalStatistics(allScoringData)

  // 小計別生スコア（renderer側でのbox plot再計算用）
  const subtotalRawScores = collectSubtotalRawScores(allScoringData)

  // 全生徒の合計点データ（renderer側での統計再計算用）
  const rawTotalScores: RawTotalScoreEntry[] = allScoringData.map(
    (scoringData) => ({
      studentId: scoringData.studentId,
      totalScore: scoringData.totalScore,
      status: scoringData.status || ("participating" as const),
      className: scoringData.className,
      grade: scoringData.grade,
    })
  )

  return {
    overall: {
      average: overallAverage,
      stdDev: overallStdDev,
      boxPlot: overallBoxPlot,
      total: allScoringData.length,
    },
    classes,
    personal: {
      deviation,
      overallRank,
    },
    questionCorrectRates,
    questionScoreRates,
    subtotalStatistics,
    subtotalRawScores,
    rawTotalScores,
  }
}
