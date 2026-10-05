/**
 * 選んだ答案の AI の判定を、まとめて自分の採点として採用するときの中身（設計 §8）。
 *
 * 注釈の置き場所は答案ごとに renderer が求める。教員が詳細で直した下書きがあれば、
 * 求めた置き場所ではなくその下書きを書く。
 */

import { DEFAULT_DRAWING_SETTINGS } from "@/components/exams/07-score-at-once/ScoringIndividual/constants/drawingConstants"
import type { AiGradingAdoption } from "@/electron-src/lib/prisma/aiGradingAdoption"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import {
  adoptionAnnotationFromDraft,
  buildAdoption,
  placeAdoptionAnnotation,
} from "./adoptionAnnotation"
import type { ReviewedAiGradingAnswer } from "./answerReview"
import { isScored } from "./scoreComparison"

export interface SelectionAdoptionContext {
  cropRegion: QuestionAnswerRegionRow
  pageSize: string
  /** 試行の id → 教員が直した朱書きの下書き（直していなければ無い） */
  draftAnnotationsByAttemptId: ReadonlyMap<string, readonly DrawingAnnotation[]>
}

/**
 * 答案1件の採用の中身。表示中の試行が成功していなければ null（採用するものが無い）
 */
export function adoptionOfAnswer(
  { answer, review }: ReviewedAiGradingAnswer,
  {
    cropRegion,
    pageSize,
    draftAnnotationsByAttemptId,
  }: SelectionAdoptionContext
): AiGradingAdoption | null {
  const attempt = review.displayedAttempt?.attempt
  if (!attempt || attempt.state !== "succeeded") return null
  const draftAnnotations = draftAnnotationsByAttemptId.get(attempt.id)
  if (draftAnnotations) {
    return {
      attemptId: attempt.id,
      annotation: adoptionAnnotationFromDraft(draftAnnotations),
    }
  }
  const placement = placeAdoptionAnnotation({
    annotationText: attempt.annotationText,
    inkGrid: answer.inkMeasurement?.inkGrid ?? null,
    region: cropRegion,
    pageSize,
    fontSizeMm: DEFAULT_DRAWING_SETTINGS.fontSize,
  })
  return buildAdoption(attempt.id, placement)
}

/**
 * 選んだ答案の採用の計画。
 * - adoptions: 採用する中身（成功した試行のあるものだけ）
 * - overwriteCount: そのうち自分が採点済みのもの（上書きの確認に件数を出す）
 * - skippedCount: 採用するものが無い答案（未判定・失敗など）
 */
export function planSelectionAdoption(
  selectedAnswers: readonly ReviewedAiGradingAnswer[],
  context: SelectionAdoptionContext
): {
  adoptions: AiGradingAdoption[]
  overwriteCount: number
  skippedCount: number
} {
  const adoptable = selectedAnswers.flatMap((reviewedAnswer) => {
    const adoption = adoptionOfAnswer(reviewedAnswer, context)
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
