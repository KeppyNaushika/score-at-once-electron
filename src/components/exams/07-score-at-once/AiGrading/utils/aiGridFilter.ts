/**
 * AI採点モードの一覧の絞り込み。一覧表示と同じ7色のボタンを「自分の採点」と
 * 「AI の採点」の2組持ち、**組の中は OR、組どうしは AND** で絞る。
 * 確信度では絞らない（確信度の低い順に並べて確かめる。`answerReview.ts`）
 */

import {
  type ScoringStatus,
  toScoringStatus,
} from "@/types/scoringStatus.types"

import type { ReviewedAiGradingAnswer } from "./answerReview"
import { isScored } from "./scoreComparison"

/** 採点状態ごとの表示の有無 */
export type StatusFilterSettings = Record<ScoringStatus, boolean>

/** 絞り込みの組（誰の採点の状態で絞るか） */
export const FILTER_SOURCES = ["mine", "ai"] as const
export type FilterSource = (typeof FILTER_SOURCES)[number]

export const FILTER_SOURCE_LABELS: Record<FilterSource, string> = {
  mine: "自分の採点",
  ai: "AI の採点",
}

/** 2組の絞り込み（自分の採点・AI の採点） */
export type AiGridFilterSettings = Record<FilterSource, StatusFilterSettings>

/**
 * 既定。自分がまだ採点しておらず、AI の判定がある答案（これから確かめるもの）だけを出す
 */
export const DEFAULT_AI_GRID_FILTER_SETTINGS: AiGridFilterSettings = {
  mine: {
    unscored: true,
    correct: false,
    partial: false,
    pending: false,
    incorrect: false,
    no_answer: false,
    double_mark: false,
  },
  ai: {
    unscored: false,
    correct: true,
    partial: true,
    pending: true,
    incorrect: true,
    no_answer: true,
    double_mark: true,
  },
}

/** 自分の採点の状態（行が無ければ未採点） */
export function myStatusOf({ answer }: ReviewedAiGradingAnswer): ScoringStatus {
  return toScoringStatus(answer.questionScore?.status)
}

/** AI の採点の状態（表示中の試行が成功していればその判定、無ければ未採点） */
export function aiStatusOf({ review }: ReviewedAiGradingAnswer): ScoringStatus {
  const attempt = review.displayedAttempt?.attempt
  return attempt?.state === "succeeded" ? attempt.status : "unscored"
}

/**
 * マスに見えている状態（並べ方の「採点種順」が使う）。自分が採点していればその判定
 * （塗り）、していなければ AI の判定（斜線）
 */
export function cellStatusOf(
  reviewedAnswer: ReviewedAiGradingAnswer
): ScoringStatus {
  return isScored(reviewedAnswer.answer.questionScore)
    ? myStatusOf(reviewedAnswer)
    : aiStatusOf(reviewedAnswer)
}

/** 絞り込みに残るか（自分の採点の組 AND AI の採点の組） */
export function isShownByFilter(
  reviewedAnswer: ReviewedAiGradingAnswer,
  filterSettings: AiGridFilterSettings
): boolean {
  return (
    filterSettings.mine[myStatusOf(reviewedAnswer)] &&
    filterSettings.ai[aiStatusOf(reviewedAnswer)]
  )
}
