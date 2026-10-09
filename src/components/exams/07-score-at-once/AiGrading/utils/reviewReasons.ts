/**
 * 答案ごとの「要確認」の理由（docs/vlm-grading-design.md §3）。
 *
 * 理由はどれも、行（試行・採点行）から導く。列には持たない（§4-3）。
 */

import type { QuestionScoreRow } from "@/queries/scoring"

import type { AttemptWithRun } from "../types"
import { isDisagreeing } from "./scoreComparison"

/** 要確認の理由（並び＝画面に出す順） */
export const REVIEW_REASONS = [
  "awaitingResult",
  "errored",
  "refused",
  "aiHold",
  "lowConfidence",
  "mediumConfidence",
  "disagreement",
] as const
export type ReviewReason = (typeof REVIEW_REASONS)[number]

export const REVIEW_REASON_LABELS: Record<ReviewReason, string> = {
  awaitingResult: "結果待ち",
  errored: "失敗",
  refused: "拒否",
  aiHold: "AI が保留",
  lowConfidence: "確信度 低",
  mediumConfidence: "確信度 中",
  disagreement: "AI≠自分",
}

/**
 * 理由の出どころ。画面では出どころごとに分けて示す
 * - ai: AI の判定そのもの（結果・確信度）
 * - comparison: AI の判定と自分の採点との比べ合わせ
 */
export type ReviewReasonSource = "ai" | "comparison"

export const REVIEW_REASON_SOURCES: Record<ReviewReason, ReviewReasonSource> = {
  awaitingResult: "ai",
  errored: "ai",
  refused: "ai",
  aiHold: "ai",
  lowConfidence: "ai",
  mediumConfidence: "ai",
  disagreement: "comparison",
}

/** 出どころが source の理由だけを、画面に出す順で返す */
export function reviewReasonsFrom(
  reviewReasons: readonly ReviewReason[],
  source: ReviewReasonSource
): ReviewReason[] {
  return reviewReasons.filter(
    (reviewReason) => REVIEW_REASON_SOURCES[reviewReason] === source
  )
}

/** 理由を求めるのに要るもの */
export interface ReviewReasonInput {
  displayedAttempt: AttemptWithRun | null
  questionScore: QuestionScoreRow | undefined
  points: number | null
}

/** 答案の要確認の理由（無ければ空） */
export function classifyReviewReasons({
  displayedAttempt,
  questionScore,
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
  return REVIEW_REASONS.filter((reason) => reasons.has(reason))
}

/** 確信度の順位（高いほど大きい）。成功していない試行の空文字は 0 */
export function confidenceRank(confidence: string): number {
  switch (confidence) {
    case "high":
      return 3
    case "medium":
      return 2
    case "low":
      return 1
    default:
      return 0
  }
}
