/**
 * 答案ごとの「要確認」の理由と、まとめて採用してよいかの判断（docs/vlm-grading-design.md §3）。
 *
 * 理由はどれも、行（試行・採点行・インクの測定）から導く。列には持たない（§4-3）。
 */

import type { QuestionScoreRow } from "@/queries/scoring"

import type { AttemptWithRun, RegionInkMeasurementRow } from "../types"
import { isAdoptedAttempt } from "./attemptSelection"
import { isDisagreeing, isScored } from "./scoreComparison"

/** 要確認の理由（並び＝画面に出す順） */
export const REVIEW_REASONS = [
  "awaitingResult",
  "errored",
  "refused",
  "aiHold",
  "lowConfidence",
  "mediumConfidence",
  "overflow",
  "disagreement",
  "borderline",
] as const
export type ReviewReason = (typeof REVIEW_REASONS)[number]

export const REVIEW_REASON_LABELS: Record<ReviewReason, string> = {
  awaitingResult: "結果待ち",
  errored: "失敗",
  refused: "拒否",
  aiHold: "AI が保留",
  lowConfidence: "確信度 低",
  mediumConfidence: "確信度 中",
  overflow: "枠からはみ出し",
  disagreement: "AI≠自分",
  borderline: "白紙か際どい",
}

/** 理由を求めるのに要るもの */
export interface ReviewReasonInput {
  displayedAttempt: AttemptWithRun | null
  questionScore: QuestionScoreRow | undefined
  inkMeasurement: RegionInkMeasurementRow | null
  points: number | null
}

/** 答案の要確認の理由（無ければ空） */
export function classifyReviewReasons({
  displayedAttempt,
  questionScore,
  inkMeasurement,
  points,
}: ReviewReasonInput): ReviewReason[] {
  const reasons = new Set<ReviewReason>()
  if (displayedAttempt) {
    const { attempt } = displayedAttempt
    switch (attempt.state) {
      case "pending":
        reasons.add("awaitingResult")
        break
      case "errored":
      case "expired":
        reasons.add("errored")
        break
      case "refused":
        reasons.add("refused")
        break
      case "succeeded":
        if (attempt.status === "pending") reasons.add("aiHold")
        if (attempt.confidence === "low") reasons.add("lowConfidence")
        if (attempt.confidence === "medium") reasons.add("mediumConfidence")
        if (isDisagreeing(attempt, questionScore, points)) {
          reasons.add("disagreement")
        }
        break
    }
  }
  if (inkMeasurement?.overflowsFrame) reasons.add("overflow")
  if (inkMeasurement?.blankness === "borderline") reasons.add("borderline")
  return REVIEW_REASONS.filter((reason) => reasons.has(reason))
}

/**
 * まとめて採用してよいか。成功・確信度 high・要確認の理由なし・自分が未採点・
 * まだ採用していない、をすべて満たすものだけ
 */
export function isBulkAdoptable(input: ReviewReasonInput): boolean {
  const { displayedAttempt, questionScore } = input
  if (!displayedAttempt) return false
  const { attempt } = displayedAttempt
  return (
    attempt.state === "succeeded" &&
    attempt.confidence === "high" &&
    classifyReviewReasons(input).length === 0 &&
    !isScored(questionScore) &&
    !isAdoptedAttempt(displayedAttempt)
  )
}
