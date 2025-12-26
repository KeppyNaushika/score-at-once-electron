/**
 * 学習アドバイス生成ロジック
 * - 差がつく問題: 正答率が中程度で、生徒が間違えた問題
 * - 必ず復習問題: 正答率が高いのに、生徒が間違えた問題
 */

import type { ScoreDetail } from "../../shared/types/export-types"
import type {
  AdviceOptions,
  AdviceQuestion,
  LearningAdviceData,
  QuestionFilterMode,
} from "./types"

/**
 * 生徒が間違えた問題かどうかを判定
 */
function isIncorrectAnswer(score: ScoreDetail): boolean {
  return (
    score.status === "incorrect" ||
    score.status === "no_answer" ||
    (score.status === "partial" && score.score !== null && score.score < score.maxScore * 0.5)
  )
}

/**
 * 差がつく問題を抽出
 * 正答率が中程度（デフォルト40%〜60%）で、生徒が間違えた問題
 */
export function findDifferentiatingQuestions(
  scores: ScoreDetail[],
  questionCorrectRates: Record<string, number>,
  options: {
    rateMin: number
    rateMax: number
    filterMode: QuestionFilterMode
    topN: number
  },
): AdviceQuestion[] {
  const { rateMin, rateMax, filterMode, topN } = options

  // 生徒が間違えた問題をフィルタリング
  const incorrectQuestions = scores.filter(isIncorrectAnswer)

  // 正答率が中程度の問題を抽出
  const candidates = incorrectQuestions
    .map((score) => {
      const correctRate = questionCorrectRates[score.questionId] ?? 0
      return {
        questionId: score.questionId,
        label: score.questionLabel,
        correctRate,
        yourScore: score.score ?? 0,
        maxScore: score.maxScore,
      }
    })
    .filter((q) => q.correctRate >= rateMin && q.correctRate <= rateMax)
    // 正答率が50%に近い順にソート（差がつきやすい問題を優先）
    .sort((a, b) => Math.abs(a.correctRate - 50) - Math.abs(b.correctRate - 50))

  // フィルタリング方式に応じて返却
  if (filterMode === "all_matching") {
    return candidates
  }
  return candidates.slice(0, topN)
}

/**
 * 必ず復習問題を抽出
 * 正答率が高い（デフォルト80%以上）のに、生徒が間違えた問題
 */
export function findMustReviewQuestions(
  scores: ScoreDetail[],
  questionCorrectRates: Record<string, number>,
  options: {
    rateMin: number
    filterMode: QuestionFilterMode
    topN: number
  },
): AdviceQuestion[] {
  const { rateMin, filterMode, topN } = options

  // 生徒が間違えた問題をフィルタリング
  const incorrectQuestions = scores.filter(isIncorrectAnswer)

  // 正答率が高い問題を抽出
  const candidates = incorrectQuestions
    .map((score) => {
      const correctRate = questionCorrectRates[score.questionId] ?? 0
      return {
        questionId: score.questionId,
        label: score.questionLabel,
        correctRate,
        yourScore: score.score ?? 0,
        maxScore: score.maxScore,
      }
    })
    .filter((q) => q.correctRate >= rateMin)
    // 正答率が高い順にソート（より多くの人ができた問題を優先）
    .sort((a, b) => b.correctRate - a.correctRate)

  // フィルタリング方式に応じて返却
  if (filterMode === "all_matching") {
    return candidates
  }
  return candidates.slice(0, topN)
}

/**
 * 学習アドバイスデータを生成
 */
export function generateLearningAdvice(
  scores: ScoreDetail[],
  questionCorrectRates: Record<string, number>,
  options: AdviceOptions,
): LearningAdviceData {
  const differentiatingQuestions = options.showDifferentiatingQuestions
    ? findDifferentiatingQuestions(scores, questionCorrectRates, {
        rateMin: options.differentiatingRateMin,
        rateMax: options.differentiatingRateMax,
        filterMode: options.differentiatingFilterMode,
        topN: options.differentiatingTopN,
      })
    : []

  const mustReviewQuestions = options.showMustReviewQuestions
    ? findMustReviewQuestions(scores, questionCorrectRates, {
        rateMin: options.mustReviewRateMin,
        filterMode: options.mustReviewFilterMode,
        topN: options.mustReviewTopN,
      })
    : []

  return {
    differentiatingQuestions,
    mustReviewQuestions,
  }
}
