/**
 * 個人成績表用統計計算ロジック
 */

import type {
  DiscriminationLevel,
  ScoringData,
} from "../../shared/types/exportTypes"
import type {
  BoxPlotData,
  RawTotalScoreEntry,
  StatisticsData,
  SubtotalRawScores,
  SubtotalStatistics,
} from "./types"

/**
 * 配列の平均値を計算
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * 配列の標準偏差を計算
 */
export function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0
  const avg = calculateAverage(values)
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2))
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length)
}

/**
 * 配列をソートして四分位数・中央値を計算（箱ひげ図用）
 * Tukey法: データを半分に分けて中央値を取る方法
 * 全数調査（試験の成績など）に適した計算方法
 */
export function calculateBoxPlotData(values: number[]): BoxPlotData {
  if (values.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0 }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length

  const min = sorted[0]
  const max = sorted[n - 1]
  const median = calculateMedian(sorted)

  // Tukey法: データを下位半分と上位半分に分けて、それぞれの中央値を取る
  // nが奇数の場合、中央値は両方の半分から除外する
  const midIndex = Math.floor(n / 2)
  const lowerHalf = sorted.slice(0, midIndex)
  const upperHalf = sorted.slice(n % 2 === 0 ? midIndex : midIndex + 1)

  const q1 = calculateMedian(lowerHalf)
  const q3 = calculateMedian(upperHalf)

  return { min, q1, median, q3, max }
}

/**
 * 配列の中央値を計算
 */
function calculateMedian(sortedValues: number[]): number {
  const n = sortedValues.length
  if (n === 0) return 0
  if (n === 1) return sortedValues[0]

  const mid = Math.floor(n / 2)
  if (n % 2 === 0) {
    // 偶数個: 中央2つの平均
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2
  } else {
    // 奇数個: 中央の値
    return sortedValues[mid]
  }
}

/**
 * 偏差値を計算
 */
export function calculateDeviation(
  score: number,
  average: number,
  stdDev: number
): number {
  if (stdDev === 0) return 50
  return Math.round(((score - average) / stdDev) * 10 + 50)
}

/**
 * 順位を計算（同点は同順位）
 */
export function calculateRank(score: number, allScores: number[]): number {
  const sorted = [...allScores].sort((a, b) => b - a)
  return sorted.findIndex((s) => s <= score) + 1
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
  const questionIds = allScoringData[0].scores.map((s) => s.questionId)

  for (const questionId of questionIds) {
    let correctCount = 0
    let totalCount = 0

    for (const data of allScoringData) {
      const score = data.scores.find((s) => s.questionId === questionId)
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

  const questionIds = allScoringData[0].scores.map((s) => s.questionId)

  for (const questionId of questionIds) {
    let scoreSum = 0
    let totalCount = 0

    for (const data of allScoringData) {
      const score = data.scores.find((s) => s.questionId === questionId)
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

    for (const data of allScoringData) {
      const subtotal = data.subtotalScores.find(
        (s) => s.subtotalId === template.subtotalId
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
      .map((data) => {
        const subtotal = data.subtotalScores.find(
          (s) => s.subtotalId === template.subtotalId
        )
        if (!subtotal || subtotal.score === null) return null
        return {
          studentId: data.studentId,
          score: subtotal.score,
          status: data.status || ("participating" as const),
        }
      })
      .filter(
        (
          s
        ): s is {
          studentId: string
          score: number
          status: "participating" | "expected" | "absent"
        } => s !== null
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

  const questionIds = allScoringData[0].scores.map((s) => s.questionId)

  for (const questionId of questionIds) {
    const itemScores: number[] = []
    const correctedTotals: number[] = []

    for (const data of allScoringData) {
      const score = data.scores.find((s) => s.questionId === questionId)
      if (!score || score.status === "unscored" || data.totalScore === null) {
        continue
      }
      const itemScore = score.score ?? 0
      itemScores.push(itemScore)
      correctedTotals.push(data.totalScore - itemScore)
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
 */
export function calculateStatisticsForStudent(
  studentId: string,
  studentScore: number | null,
  allScoringData: ScoringData[],
  classScoringData: ScoringData[],
  questionCorrectRates: Record<string, number>,
  questionScoreRates: Record<string, number>
): StatisticsData {
  // 全体のスコア配列（null を除外）
  const allScores = allScoringData
    .map((d) => d.totalScore)
    .filter((s): s is number => s !== null)
  const classScores = classScoringData
    .map((d) => d.totalScore)
    .filter((s): s is number => s !== null)

  // 全体統計
  const overallAverage = calculateAverage(allScores)
  const overallStdDev = calculateStdDev(allScores)
  const overallBoxPlot = calculateBoxPlotData(allScores)

  // 学級統計
  const classAverage = calculateAverage(classScores)
  const classStdDev = calculateStdDev(classScores)
  const classBoxPlot = calculateBoxPlotData(classScores)

  // 個人統計（studentScore === null の場合は deviation=0, rank=0）
  const deviation =
    studentScore !== null
      ? calculateDeviation(studentScore, overallAverage, overallStdDev)
      : 0
  const overallRank =
    studentScore !== null ? calculateRank(studentScore, allScores) : 0
  const classRank =
    studentScore !== null ? calculateRank(studentScore, classScores) : 0

  // 小計別統計（SubtotalScoreから直接グループ情報を取得）
  const subtotalStatistics = calculateSubtotalStatistics(allScoringData)

  // 小計別生スコア（renderer側でのbox plot再計算用）
  const subtotalRawScores = collectSubtotalRawScores(allScoringData)

  // 全生徒の合計点データ（renderer側での統計再計算用）
  const rawTotalScores: RawTotalScoreEntry[] = allScoringData.map((d) => ({
    studentId: d.studentId,
    totalScore: d.totalScore,
    status: d.status || ("participating" as const),
    className: d.className,
    grade: d.grade,
  }))

  return {
    overall: {
      average: overallAverage,
      stdDev: overallStdDev,
      boxPlot: overallBoxPlot,
      total: allScoringData.length,
    },
    class: {
      average: classAverage,
      stdDev: classStdDev,
      boxPlot: classBoxPlot,
      total: classScoringData.length,
    },
    personal: {
      deviation,
      overallRank,
      classRank,
    },
    questionCorrectRates,
    questionScoreRates,
    subtotalStatistics,
    subtotalRawScores,
    rawTotalScores,
  }
}
