/**
 * 「白紙を無答に」の対象（docs/vlm-grading-design.md §7）。
 *
 * 白紙はその場のインク率だけで決める（main の `classifyAnswerBlankness`）。
 * 境界帯（borderline）・測れなかった答案は含めない。自分が採点済みの答案も含めない
 */

import type { ReviewedAiGradingAnswer } from "./answerReview"
import { isScored } from "./scoreComparison"

/** 白紙を無答にする対象（インク率で白紙、かつ自分が未採点）の受験者の id（一覧の並び） */
export function blankUnscoredExamStudentIds(
  reviewedAnswers: readonly ReviewedAiGradingAnswer[]
): string[] {
  return reviewedAnswers
    .filter(
      (reviewedAnswer) =>
        reviewedAnswer.answer.inkMeasurement?.blankness === "blank" &&
        !isScored(reviewedAnswer.answer.questionScore)
    )
    .map(
      (reviewedAnswer) => reviewedAnswer.answer.studentAnswerImage.examStudentId
    )
}
