/**
 * 学習アドバイス生成ロジック
 * 復習問題: 正答率が閾値以上で、生徒が正答でなかった問題
 */

import type { ScoreDetail } from "../../shared/types/exportTypes"
import type { AdviceOptions, AdviceQuestion, LearningAdviceData } from "./types"

/**
 * 正答以外の問題かどうかを判定
 * correct以外の全てのステータス（incorrect, partial, no_answer, hold, unscored）が対象
 */
function isNotCorrectAnswer(score: ScoreDetail): boolean {
  return score.status !== "correct"
}

/**
 * 復習問題を抽出
 * 正答率が閾値以上の問題で、生徒が正答でなかったもの
 */
export function findReviewQuestions(
  scores: ScoreDetail[],
  questionCorrectRates: Record<string, number>,
  options: AdviceOptions
): AdviceQuestion[] {
  // 正答以外の問題をフィルタリング
  const nonCorrectQuestions = scores.filter(isNotCorrectAnswer)

  // 問題データを構築
  let candidates = nonCorrectQuestions.map((score) => {
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

/**
 * 学習アドバイスデータを生成
 */
export function generateLearningAdvice(
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
