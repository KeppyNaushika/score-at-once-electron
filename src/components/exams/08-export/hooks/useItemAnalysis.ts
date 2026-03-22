"use client"

import { useMemo } from "react"

import type { ExcelPreviewData } from "./useExcelPreview"

export type DiscriminationLevel =
  | "good"
  | "acceptable"
  | "marginal"
  | "poor"
  | "negative"
  | "insufficient"

export interface ItemAnalysisData {
  questionLabel: string
  maxScore: number
  correctRate: number
  scoreRate: number
  discriminationIndex: number | null
  level: DiscriminationLevel
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const avg = average(values)
  const squaredDiffs = values.map((v) => (v - avg) ** 2)
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length)
}

function getLevel(r: number | null): DiscriminationLevel {
  if (r === null) return "insufficient"
  if (r < 0) return "negative"
  if (r < 0.2) return "poor"
  if (r < 0.3) return "marginal"
  if (r < 0.4) return "acceptable"
  return "good"
}

/** 設問ごとの正答率・得点率・識別係数を算出する項目分析フック */
export function useItemAnalysis(
  data: ExcelPreviewData | null
): ItemAnalysisData[] | null {
  return useMemo(() => {
    if (!data || data.rows.length === 0) return null

    const questionCount = data.headers.questionLabels.length
    if (questionCount === 0) return null

    const results: ItemAnalysisData[] = []

    for (let qi = 0; qi < questionCount; qi++) {
      const label = data.headers.questionLabels[qi]
      const maxScore = data.headers.questionMaxScores[qi]

      // 採点済みデータのみ集計
      const itemScores: number[] = []
      const correctedTotals: number[] = []
      let correctCount = 0
      let scoredCount = 0
      let scoreRateSum = 0

      for (const row of data.rows) {
        const score = row.scores[qi]
        if (!score || score.status === "unscored") continue

        scoredCount++
        const itemScore = score.score ?? 0
        itemScores.push(itemScore)

        if (score.status === "correct") correctCount++
        if (maxScore > 0) scoreRateSum += itemScore / maxScore

        if (row.totalScore !== null) {
          correctedTotals.push(row.totalScore - itemScore)
        }
      }

      const correctRate =
        scoredCount > 0 ? (correctCount / scoredCount) * 100 : 0
      const scoreRate = scoredCount > 0 ? (scoreRateSum / scoredCount) * 100 : 0

      // 識別係数（補正済み項目合計相関）
      let discriminationIndex: number | null = null
      if (
        itemScores.length >= 3 &&
        itemScores.length === correctedTotals.length
      ) {
        const itemSd = stdDev(itemScores)
        const totalSd = stdDev(correctedTotals)
        if (itemSd > 0 && totalSd > 0) {
          const itemMean = average(itemScores)
          const totalMean = average(correctedTotals)
          let cov = 0
          for (let i = 0; i < itemScores.length; i++) {
            cov += (itemScores[i] - itemMean) * (correctedTotals[i] - totalMean)
          }
          cov /= itemScores.length
          discriminationIndex = cov / (itemSd * totalSd)
        }
      }

      results.push({
        questionLabel: label,
        maxScore,
        correctRate,
        scoreRate,
        discriminationIndex,
        level: getLevel(discriminationIndex),
      })
    }

    return results
  }, [data])
}
