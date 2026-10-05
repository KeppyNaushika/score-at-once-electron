/**
 * AI採点モードの一覧の絞り込み。ボタンは一覧表示と同じ7色（採点状態）で、
 * 何の状態で絞るか（AI の提案か、自分の採点か）を選べる。
 */

import {
  type ScoringStatus,
  toScoringStatus,
} from "@/types/scoringStatus.types"

import type { ReviewedAiGradingAnswer } from "./answerReview"

/** 絞り込みの基準 */
export const FILTER_BASES = ["ai", "mine"] as const
export type FilterBasis = (typeof FILTER_BASES)[number]

export const FILTER_BASIS_LABELS: Record<FilterBasis, string> = {
  ai: "AIの提案",
  mine: "自分の採点",
}

/** 採点状態ごとの表示の有無 */
export type StatusFilterSettings = Record<ScoringStatus, boolean>

/** AI採点モードの既定（すべて表示。AI の提案は全部を見比べたいので一覧表示とは違う） */
export const ALL_STATUSES_VISIBLE: StatusFilterSettings = {
  unscored: true,
  correct: true,
  partial: true,
  pending: true,
  incorrect: true,
  no_answer: true,
  double_mark: true,
}

/**
 * 答案を絞り込むときの状態。
 * - ai: 表示中の試行が成功していればその判定、無い・成功していなければ未採点
 * - mine: 自分の採点（行が無ければ未採点）
 */
export function filterStatusOf(
  { answer, review }: ReviewedAiGradingAnswer,
  basis: FilterBasis
): ScoringStatus {
  if (basis === "mine") {
    return toScoringStatus(answer.questionScore?.status)
  }
  const attempt = review.displayedAttempt?.attempt
  return attempt?.state === "succeeded" ? attempt.status : "unscored"
}

/** 絞り込みに残るか */
export function isShownByFilter(
  reviewedAnswer: ReviewedAiGradingAnswer,
  filterSettings: StatusFilterSettings,
  basis: FilterBasis
): boolean {
  return filterSettings[filterStatusOf(reviewedAnswer, basis)]
}
