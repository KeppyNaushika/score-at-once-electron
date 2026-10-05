/**
 * 答案ごとに、表示中の試行から導く印（docs/vlm-grading-design.md §4-3）。
 *
 * 一覧・詳細・まとめての操作が同じものを見るよう、導き方をここに集める。
 */

import type { AiGradingAnswer, AttemptWithRun } from "../types"
import { isAdoptedAttempt, resolveDisplayedAttempt } from "./attemptSelection"
import { classifyReviewReasons, type ReviewReason } from "./reviewReasons"
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
    )
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
export const ANSWER_ORDERS = ["display", "reviewFirst"] as const
export type AnswerOrder = (typeof ANSWER_ORDERS)[number]

export const ANSWER_ORDER_LABELS: Record<AnswerOrder, string> = {
  display: "表示順",
  reviewFirst: "要確認を先に",
}

/**
 * 並べる。要確認を先にするときは、理由のある答案を先へ出し、その中も外も表示順を保つ
 * （安定な並べ替え）
 */
export function orderReviewedAnswers<Reviewed extends { review: AnswerReview }>(
  reviewedAnswers: readonly Reviewed[],
  answerOrder: AnswerOrder
): Reviewed[] {
  if (answerOrder === "display") return [...reviewedAnswers]
  return reviewedAnswers.toSorted(
    (reviewedA, reviewedB) =>
      Number(reviewedB.review.reviewReasons.length > 0) -
      Number(reviewedA.review.reviewReasons.length > 0)
  )
}

/** 答案と、そこから導いた印の組（一覧・詳細・まとめての操作が受け取る形） */
export interface ReviewedAiGradingAnswer {
  answer: AiGradingAnswer
  review: AnswerReview
}
