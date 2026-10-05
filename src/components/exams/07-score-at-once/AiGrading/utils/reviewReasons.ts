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

/**
 * 理由の出どころ。画面では出どころごとに分けて示す（AI の判断と、アプリが画像から
 * 測ったものを同じ並びに置くと、どれが AI の判断か読み分けられないため）
 * - ai: AI の判定そのもの（結果・確信度）
 * - comparison: AI の判定と自分の採点との比べ合わせ
 * - image: アプリが答案画像から測ったもの（AI は関わらない）
 */
export type ReviewReasonSource = "ai" | "comparison" | "image"

export const REVIEW_REASON_SOURCES: Record<ReviewReason, ReviewReasonSource> = {
  awaitingResult: "ai",
  errored: "ai",
  refused: "ai",
  aiHold: "ai",
  lowConfidence: "ai",
  mediumConfidence: "ai",
  overflow: "image",
  disagreement: "comparison",
  borderline: "image",
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
 * まとめて採用の確信度の下限。"low" は確信度を問わない（すべて）。
 * 教員が画面で選ぶ（既定は "high"）
 */
export const BULK_ADOPT_MINIMUM_CONFIDENCES = ["high", "medium", "low"] as const
export type BulkAdoptMinimumConfidence =
  (typeof BULK_ADOPT_MINIMUM_CONFIDENCES)[number]

export const BULK_ADOPT_MINIMUM_CONFIDENCE_LABELS: Record<
  BulkAdoptMinimumConfidence,
  string
> = {
  high: "確信度 高のみ",
  medium: "確信度 中以上",
  low: "すべて",
}

/** 確信度の順位（高いほど大きい）。成功していない試行の空文字は 0 */
function confidenceRank(confidence: string): number {
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

/**
 * まとめて採用してよいか。成功・確信度が下限以上・自分が未採点・まだ採用していない、を
 * すべて満たすもの。
 *
 * 確信度以外の要確認の理由（はみ出し・際どい白紙など）では外さない。外すかどうかは
 * 確信度の下限を選ぶ教員の判断に任せ、画面ではその件数を示す
 */
export function isBulkAdoptable(
  input: ReviewReasonInput,
  minimumConfidence: BulkAdoptMinimumConfidence
): boolean {
  const { displayedAttempt, questionScore } = input
  if (!displayedAttempt) return false
  const { attempt } = displayedAttempt
  return (
    attempt.state === "succeeded" &&
    confidenceRank(attempt.confidence) >= confidenceRank(minimumConfidence) &&
    !isScored(questionScore) &&
    !isAdoptedAttempt(displayedAttempt)
  )
}
