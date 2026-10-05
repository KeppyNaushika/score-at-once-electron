/**
 * 答案ごとに、表示中の試行から導く印（docs/vlm-grading-design.md §4-3）。
 *
 * 一覧・詳細・まとめての操作が同じものを見るよう、導き方をここに集める。
 */

import { SCORING_STATUS_ORDER } from "@/lib/scoringStatusColors"

import type { AiGradingAnswer, AttemptWithRun } from "../types"
import { cellStatusOf } from "./aiGridFilter"
import { isAdoptedAttempt, resolveDisplayedAttempt } from "./attemptSelection"
import {
  classifyReviewReasons,
  confidenceRank,
  type ReviewReason,
} from "./reviewReasons"
import {
  isSameJudgement,
  isScored,
  judgementOfQuestionScore,
} from "./scoreComparison"

/** 答案1件の印（計算した値。行は持たない） */
export interface AnswerReview {
  displayedAttempt: AttemptWithRun | null
  reviewReasons: ReviewReason[]
  /** 表示中の試行が、選んでいるプロンプトとは別のプロンプトのもの */
  isFromOtherPrompt: boolean
  /** 表示中の試行を採用した */
  isAdopted: boolean
  /** 採用したあとで、自分の採点を AI の判定から変えた（表示するだけで上書きしない） */
  isChangedAfterAdoption: boolean
}

export interface AnswerReviewContext {
  /** 答案ごとに `<` `>` で選んだ試行 */
  chosenAttemptIdByExamStudentId: ReadonlyMap<string, string>
  /** 実行の履歴で選んだ実行（null は最新）。`<` `>` の選択が優先する */
  chosenRunId?: string | null
  selectedPromptId: string | null
  points: number | null
}

/** 答案1件の印を求める */
export function reviewAnswer(
  answer: AiGradingAnswer,
  context: AnswerReviewContext
): AnswerReview {
  const displayedAttempt = resolveDisplayedAttempt(
    answer.attempts,
    context.chosenAttemptIdByExamStudentId.get(
      answer.studentAnswerImage.examStudentId
    ),
    context.chosenRunId ?? null
  )
  const reviewInput = {
    displayedAttempt,
    questionScore: answer.questionScore,
    inkMeasurement: answer.inkMeasurement,
    points: context.points,
  }
  const isAdopted = displayedAttempt
    ? isAdoptedAttempt(displayedAttempt)
    : false
  return {
    displayedAttempt,
    reviewReasons: classifyReviewReasons(reviewInput),
    isFromOtherPrompt:
      displayedAttempt !== null &&
      context.selectedPromptId !== null &&
      displayedAttempt.run.promptId !== context.selectedPromptId,
    isAdopted,
    isChangedAfterAdoption:
      displayedAttempt !== null &&
      isAdopted &&
      answer.questionScore !== undefined &&
      isScored(answer.questionScore) &&
      !isSameJudgement(
        displayedAttempt.attempt,
        judgementOfQuestionScore(answer.questionScore),
        context.points
      ),
  }
}

/** 一覧の並べ方 */
export const ANSWER_ORDERS = ["display", "confidence", "status"] as const
export type AnswerOrder = (typeof ANSWER_ORDERS)[number]

export const ANSWER_ORDER_LABELS: Record<AnswerOrder, string> = {
  display: "生徒順",
  confidence: "確信度順",
  status: "採点種順",
}

/** 表示中の試行の確信度の順位（成功していなければ 0） */
function displayedConfidenceRank({ review }: ReviewedAiGradingAnswer): number {
  const attempt = review.displayedAttempt?.attempt
  return attempt?.state === "succeeded" ? confidenceRank(attempt.confidence) : 0
}

/**
 * 並べる（どれも安定な並べ替えで、同じ組の中は生徒順を保つ）。
 * - confidence: 表示中の AI の判定の確信度が高い順（判定の無い答案は最後）
 * - status: マスに見えている状態（自分の採点、無ければ AI の提案）の、絞り込みのボタンと同じ順
 */
export function orderReviewedAnswers<Reviewed extends ReviewedAiGradingAnswer>(
  reviewedAnswers: readonly Reviewed[],
  answerOrder: AnswerOrder
): Reviewed[] {
  switch (answerOrder) {
    case "display":
      return [...reviewedAnswers]
    case "confidence":
      return reviewedAnswers.toSorted(
        (reviewedA, reviewedB) =>
          displayedConfidenceRank(reviewedB) -
          displayedConfidenceRank(reviewedA)
      )
    case "status":
      return reviewedAnswers.toSorted(
        (reviewedA, reviewedB) =>
          SCORING_STATUS_ORDER.indexOf(cellStatusOf(reviewedA)) -
          SCORING_STATUS_ORDER.indexOf(cellStatusOf(reviewedB))
      )
  }
}

/** 答案と、そこから導いた印の組（一覧・詳細・まとめての操作が受け取る形） */
export interface ReviewedAiGradingAnswer {
  answer: AiGradingAnswer
  review: AnswerReview
}
