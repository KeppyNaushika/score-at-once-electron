import { useMemo, useState } from "react"

import type { AiGradingAnswer } from "../types"
import {
  type AnswerOrder,
  orderReviewedAnswers,
  reviewAnswer,
} from "../utils/answerReview"

interface UseAiAnswerReviewStateOptions {
  answers: AiGradingAnswer[]
  selectedPromptId: string | null
  points: number | null
}

/**
 * 答案ごとの利用者の選択（`<` `>` で選んだ試行・並べ方）と、そこから導く印。
 * 持つのは利用者が選んだものだけで、表示は毎回導く
 */
export function useAiAnswerReviewState({
  answers,
  selectedPromptId,
  points,
}: UseAiAnswerReviewStateOptions) {
  const [chosenAttemptIdByExamStudentId, setChosenAttemptIdByExamStudentId] =
    useState<ReadonlyMap<string, string>>(new Map())
  const [answerOrder, setAnswerOrder] = useState<AnswerOrder>("display")

  const reviewedAnswers = useMemo(
    () =>
      orderReviewedAnswers(
        answers.map((answer) => ({
          answer,
          review: reviewAnswer(answer, {
            chosenAttemptIdByExamStudentId,
            selectedPromptId,
            points,
          }),
        })),
        answerOrder
      ),
    [
      answers,
      chosenAttemptIdByExamStudentId,
      selectedPromptId,
      points,
      answerOrder,
    ]
  )

  const chooseAttempt = (examStudentId: string, attemptId: string) => {
    setChosenAttemptIdByExamStudentId((prev) =>
      new Map(prev).set(examStudentId, attemptId)
    )
  }

  return { reviewedAnswers, chooseAttempt, answerOrder, setAnswerOrder }
}
