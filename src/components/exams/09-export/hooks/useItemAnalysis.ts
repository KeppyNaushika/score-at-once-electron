"use client"

import { useMemo } from "react"

import {
  computeItemAnalysis,
  type ItemAnalysisInputStudent,
  type ItemAnalysisResult,
} from "@/lib/shared/itemAnalysis"

import type { ExcelPreviewData } from "./useExcelPreview"

/**
 * 設問ごとの正答率・得点率・識別係数・D値とテスト全体のα係数を算出する項目分析フック。
 * 類型評価の設問は正答率の代わりに類型ごとの人数を出す。
 * 計算は共有モジュール（`itemAnalysis.ts`）に委譲し、Excel「問題分析」シートと完全に一致させる。
 */
export function useItemAnalysis(
  data: ExcelPreviewData | null
): ItemAnalysisResult | null {
  return useMemo(() => {
    if (!data || data.rows.length === 0) return null
    if (data.headers.questionLabels.length === 0) return null

    const input: ItemAnalysisInputStudent[] = data.rows.map((row) => ({
      items: row.scores.map((questionScore, questionIndex) => {
        const scaleLevels = data.headers.questionScaleLevels[questionIndex]
        return {
          questionId: questionScore.questionId,
          label:
            data.headers.questionLabels[questionIndex] ??
            questionScore.questionLabel,
          maxScore:
            data.headers.questionMaxScores[questionIndex] ??
            questionScore.maxScore,
          // 解決済み得点（未採点・未確定は null、無回答は 0）をそのまま使う
          score: questionScore.score,
          isCorrect: questionScore.status === "correct",
          // 類型評価の設問は、組の類型を全部と付けた類型を渡す（類型ごとの人数を出す）
          scale: scaleLevels
            ? {
                levels: scaleLevels,
                scaleLevelId: questionScore.scaleLevel?.id ?? null,
              }
            : null,
        }
      }),
    }))

    return computeItemAnalysis(input)
  }, [data])
}
