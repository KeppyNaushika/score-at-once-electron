"use client"

import { useMemo } from "react"

import {
  computeItemAnalysis,
  type ItemAnalysisInputStudent,
  type ItemAnalysisResult,
} from "@/electron-src/lib/shared/calculations/itemAnalysis"

import type { ExcelPreviewData } from "./useExcelPreview"

/**
 * 設問ごとの正答率・得点率・識別係数・D値とテスト全体のα係数を算出する項目分析フック。
 * 計算は共有モジュール（`itemAnalysis.ts`）に委譲し、Excel「問題分析」シートと完全に一致させる。
 */
export function useItemAnalysis(
  data: ExcelPreviewData | null
): ItemAnalysisResult | null {
  return useMemo(() => {
    if (!data || data.rows.length === 0) return null
    if (data.headers.questionLabels.length === 0) return null

    const input: ItemAnalysisInputStudent[] = data.rows.map((row) => ({
      items: row.scores.map((s, qi) => ({
        questionId: s.questionId,
        label: data.headers.questionLabels[qi] ?? s.questionLabel,
        maxScore: data.headers.questionMaxScores[qi] ?? s.maxScore,
        // 解決済み得点（未採点・未確定は null、無回答は 0）をそのまま使う
        score: s.score,
        isCorrect: s.status === "correct",
      })),
    }))

    return computeItemAnalysis(input)
  }, [data])
}
