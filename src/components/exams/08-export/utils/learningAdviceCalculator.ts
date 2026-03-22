/**
 * 学習アドバイス計算ユーティリティ（フロントエンド用）
 * adviceOptionsの変更をリアルタイムでプレビューに反映
 */

import type {
  AdviceOptions,
  AdviceQuestion,
  LearningAdviceData,
} from "@/electron-src/lib/export/individual-report/types"
import type { ScoreDetail } from "@/electron-src/lib/shared/types/exportTypes"

/**
 * 生徒が間違えた問題かどうかを判定
 */
function isIncorrectAnswer(score: ScoreDetail): boolean {
  return (
    score.status === "incorrect" ||
    score.status === "no_answer" ||
    (score.status === "partial" &&
      score.score !== null &&
      score.score < score.maxScore * 0.5)
  )
}

/**
 * 復習問題を抽出
 * 正答率が閾値以上の問題で、生徒が間違えたもの
 */
function findReviewQuestions(
  scores: ScoreDetail[],
  questionCorrectRates: Record<string, number>,
  options: AdviceOptions
): AdviceQuestion[] {
  // 生徒が間違えた問題をフィルタリング
  const incorrectQuestions = scores.filter(isIncorrectAnswer)

  // 問題データを構築
  let candidates = incorrectQuestions.map((score) => {
    const correctRate = questionCorrectRates[score.questionId] ?? 0
    return {
      questionId: score.questionId,
      label: score.questionLabel,
      correctRate,
      yourScore: score.score ?? 0,
      maxScore: score.maxScore,
    }
  })

  // 正答率の下限でフィルタリング（nullの場合はフィルタリングなし）
  if (options.reviewRateMin !== null) {
    candidates = candidates.filter(
      (q) => q.correctRate >= options.reviewRateMin!
    )
  }

  // 正答率の上限でフィルタリング（nullの場合はフィルタリングなし）
  if (options.reviewRateMax !== null) {
    candidates = candidates.filter(
      (q) => q.correctRate <= options.reviewRateMax!
    )
  }

  // 正答率が高い順にソート（より多くの人ができた問題を優先）
  candidates.sort((a, b) => b.correctRate - a.correctRate)

  // 問題数で制限（nullの場合は全て表示）
  if (options.reviewQuestionCount !== null) {
    candidates = candidates.slice(0, options.reviewQuestionCount)
  }

  return candidates
}

/** 生徒の採点結果と正答率から復習すべき問題を抽出し学習アドバイスを生成する */
export function calculateLearningAdvice(
  scores: ScoreDetail[],
  questionCorrectRates: Record<string, number>,
  options: AdviceOptions
): LearningAdviceData {
  const reviewQuestions = findReviewQuestions(
    scores,
    questionCorrectRates,
    options
  )

  return {
    reviewQuestions,
  }
}
