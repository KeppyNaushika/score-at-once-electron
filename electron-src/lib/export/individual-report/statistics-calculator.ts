/**
 * 個人成績表用統計計算ロジック
 */

import type { ScoringData, ScoreDetail } from "../../shared/types/export-types"
import type { BoxPlotData, StatisticsData, SubtotalStatistics } from "./types"

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
 */
export function calculateBoxPlotData(values: number[]): BoxPlotData {
  if (values.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0 }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length

  const min = sorted[0]
  const max = sorted[n - 1]
  const median = calculatePercentile(sorted, 50)
  const q1 = calculatePercentile(sorted, 25)
  const q3 = calculatePercentile(sorted, 75)

  return { min, q1, median, q3, max }
}

/**
 * パーセンタイル値を計算（線形補間）
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0
  if (sortedValues.length === 1) return sortedValues[0]

  const index = (percentile / 100) * (sortedValues.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower

  if (lower === upper) return sortedValues[lower]
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
}

/**
 * 偏差値を計算
 */
export function calculateDeviation(score: number, average: number, stdDev: number): number {
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
  allScoringData: ScoringData[],
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
        } else if (score.status === "partial" && score.score !== null && score.maxScore > 0) {
          // 部分点の場合は得点率を考慮
          correctCount += score.score / score.maxScore
        }
      }
    }

    rates[questionId] = totalCount > 0 ? (correctCount / totalCount) * 100 : 0
  }

  return rates
}

/**
 * 小計別統計データを計算
 */
export function calculateSubtotalStatistics(
  allScoringData: ScoringData[],
): SubtotalStatistics[] {
  if (allScoringData.length === 0 || allScoringData[0].subtotalScores.length === 0) {
    return []
  }

  const subtotalIds = allScoringData[0].subtotalScores.map((s) => s.subtotalRegionId)

  return subtotalIds.map((subtotalId) => {
    const scores: number[] = []
    let label = ""

    for (const data of allScoringData) {
      const subtotal = data.subtotalScores.find((s) => s.subtotalRegionId === subtotalId)
      if (subtotal) {
        scores.push(subtotal.score)
        label = subtotal.subtotalLabel
      }
    }

    return {
      subtotalId,
      subtotalLabel: label,
      average: calculateAverage(scores),
      stdDev: calculateStdDev(scores),
      boxPlot: calculateBoxPlotData(scores),
    }
  })
}

/**
 * 特定の生徒の統計データを計算
 */
export function calculateStatisticsForStudent(
  studentId: string,
  studentScore: number,
  allScoringData: ScoringData[],
  classScoringData: ScoringData[],
  questionCorrectRates: Record<string, number>,
): StatisticsData {
  // 全体のスコア配列
  const allScores = allScoringData.map((d) => d.totalScore)
  const classScores = classScoringData.map((d) => d.totalScore)

  // 全体統計
  const overallAverage = calculateAverage(allScores)
  const overallStdDev = calculateStdDev(allScores)
  const overallBoxPlot = calculateBoxPlotData(allScores)

  // 学級統計
  const classAverage = calculateAverage(classScores)
  const classStdDev = calculateStdDev(classScores)
  const classBoxPlot = calculateBoxPlotData(classScores)

  // 個人統計
  const deviation = calculateDeviation(studentScore, overallAverage, overallStdDev)
  const overallRank = calculateRank(studentScore, allScores)
  const classRank = calculateRank(studentScore, classScores)

  // 小計別統計
  const subtotalStatistics = calculateSubtotalStatistics(allScoringData)

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
    subtotalStatistics,
  }
}
