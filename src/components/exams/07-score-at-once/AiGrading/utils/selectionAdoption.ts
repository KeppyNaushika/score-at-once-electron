/**
 * 選んだ答案の AI の判定を、まとめて自分の採点として採用するときの中身。
 *
 * 書くのは点（判定・部分点・教員向けの理由）だけ。AI が答案ごとに書いた朱書きの文案は
 * 採用しない（朱書きはルーブリック項目の助言から作る。docs/vlm-grading-design.md §4-7）。
 */

import type { AiGradingAdoption } from "@/electron-src/lib/prisma/aiGradingAdoption"

import type { ReviewedAiGradingAnswer } from "./answerReview"
import { isScored } from "./scoreComparison"

/**
 * 答案1件の採用の中身。表示中の試行が成功していなければ null（採用するものが無い）
 */
function adoptionOfAnswer({
  review,
}: ReviewedAiGradingAnswer): AiGradingAdoption | null {
  const attempt = review.displayedAttempt?.attempt
  if (!attempt || attempt.state !== "succeeded") return null
  return { attemptId: attempt.id }
}

/**
 * 選んだ答案の採用の計画。
 * - adoptions: 採用する中身（成功した試行のあるものだけ）
 * - overwriteCount: そのうち自分が採点済みのもの（上書きの確認に件数を出す）
 * - skippedCount: 採用するものが無い答案（未判定・失敗など）
 */
export function planSelectionAdoption(
  selectedAnswers: readonly ReviewedAiGradingAnswer[]
): {
  adoptions: AiGradingAdoption[]
  overwriteCount: number
  skippedCount: number
} {
  const adoptable = selectedAnswers.flatMap((reviewedAnswer) => {
    const adoption = adoptionOfAnswer(reviewedAnswer)
    return adoption ? [{ reviewedAnswer, adoption }] : []
  })
  return {
    adoptions: adoptable.map(({ adoption }) => adoption),
    overwriteCount: adoptable.filter(({ reviewedAnswer }) =>
      isScored(reviewedAnswer.answer.questionScore)
    ).length,
    skippedCount: selectedAnswers.length - adoptable.length,
  }
}
