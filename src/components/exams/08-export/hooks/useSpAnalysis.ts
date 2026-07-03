"use client"

import { useMemo } from "react"

import {
  computeFrequencyDistribution,
  computeSpTable,
  type FrequencyDistributionResult,
  type SpInputStudent,
  type SpTableResult,
} from "@/electron-src/lib/shared/calculations/spAnalysis"

import type { ExcelPreviewData } from "./useExcelPreview"

export interface SpAnalysisResult {
  spTable: SpTableResult | null
  frequency: FrequencyDistributionResult | null
}

/** S-P表・得点度数分布をプレビュー用に算出するフック（#838、計算は共有モジュール） */
export function useSpAnalysis(
  data: ExcelPreviewData | null
): SpAnalysisResult | null {
  return useMemo(() => {
    if (!data || data.rows.length === 0) return null

    const input: SpInputStudent[] = data.rows.map((row) => ({
      studentId: row.studentId,
      studentName: row.studentName,
      items: row.scores.map((questionScore) => ({
        questionId: questionScore.questionId,
        label: questionScore.questionLabel,
        isCorrect: questionScore.status === "correct",
        isScored: questionScore.status !== "unscored",
      })),
    }))

    const totalScores = data.rows.map((r) => r.totalScore)
    const maxScore = data.rows[0]?.totalMaxScore ?? 0

    return {
      spTable: computeSpTable(input),
      frequency: computeFrequencyDistribution(totalScores, maxScore),
    }
  }, [data])
}
