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
  draftAnnotationsFromPlacement,
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
 * 一覧に重ねて見せる、まだ反映していない AI の朱書き（反映したらこの形で書かれるもの）。
 * 教員が直した下書きがあればそれ、無ければ求めた置き場所。表示中の試行が成功していない・
 * 朱書きの文が無い・その試行の朱書きを反映済みなら空
 */
export function pendingAnnotationsOfAnswer(
  { answer, review }: ReviewedAiGradingAnswer,
  {
    cropRegion,
    pageSize,
    draftAnnotationsByAttemptId,
  }: SelectionAdoptionContext
): readonly DrawingAnnotation[] {
  const attempt = review.displayedAttempt?.attempt
  if (
    !attempt ||
    attempt.state !== "succeeded" ||
    attempt.annotationText.trim() === "" ||
    attempt.adoptedDrawingAnnotationId !== null
  ) {
    return []
  }
  return (
    draftAnnotationsByAttemptId.get(attempt.id) ??
    draftAnnotationsFromPlacement(
      placeAdoptionAnnotation({
        annotationText: attempt.annotationText,
        inkGrid: answer.inkMeasurement?.inkGrid ?? null,
        region: cropRegion,
        pageSize,
        fontSizeMm: DEFAULT_DRAWING_SETTINGS.fontSize,
      })
    )
  )
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
