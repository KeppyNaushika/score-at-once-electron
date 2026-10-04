import { useMemo, useState } from "react"

import type { AiGradingAnswer } from "../types"
import {
  type AnswerOrder,
  orderReviewedAnswers,
  reviewAnswer,
} from "../utils/answerReview"
import { useAiAnswerNavigationShortcuts } from "./useAiGradingShortcuts"

interface UseAiAnswerReviewStateOptions {
  answers: AiGradingAnswer[]
  selectedPromptId: string | null
  points: number | null
}

/**
 * 答案の一覧の利用者の選択（`<` `>` で選んだ試行・選んだ答案・詳細に出す答案・並べ方）と、
 * そこから導く印。持つのは利用者が選んだものだけで、表示は毎回導く
 * （消えた選択を状態へ書き戻さない。詳細に出す答案が消えたら先頭を出す）
 */
export function useAiAnswerReviewState({
  answers,
  selectedPromptId,
  points,
}: UseAiAnswerReviewStateOptions) {
  const [chosenAttemptIdByExamStudentId, setChosenAttemptIdByExamStudentId] =
    useState<ReadonlyMap<string, string>>(new Map())
  const [selectedExamStudentIds, setSelectedExamStudentIds] = useState<
    ReadonlySet<string>
  >(new Set())
  const [focusedExamStudentId, setFocusedExamStudentId] = useState<
    string | null
  >(null)
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
  const focusedIndex = reviewedAnswers.findIndex(
    (reviewedAnswer) =>
      reviewedAnswer.answer.studentAnswerImage.examStudentId ===
      focusedExamStudentId
  )
  const focusedAnswer =
    reviewedAnswers[focusedIndex] ?? reviewedAnswers[0] ?? null

  const moveFocus = (offset: number) => {
    const currentIndex = focusedIndex === -1 ? 0 : focusedIndex
    const nextAnswer =
      reviewedAnswers[
        Math.min(Math.max(currentIndex + offset, 0), reviewedAnswers.length - 1)
      ]
    if (nextAnswer) {
      setFocusedExamStudentId(
        nextAnswer.answer.studentAnswerImage.examStudentId
      )
    }
  }
  useAiAnswerNavigationShortcuts({
    onPrevAnswer: () => moveFocus(-1),
    onNextAnswer: () => moveFocus(1),
  })

  const chooseAttempt = (examStudentId: string, attemptId: string) => {
    setChosenAttemptIdByExamStudentId((prev) =>
      new Map(prev).set(examStudentId, attemptId)
    )
  }
  const toggleSelected = (examStudentId: string) => {
    setSelectedExamStudentIds((prev) => {
      const next = new Set(prev)
      if (next.has(examStudentId)) {
        next.delete(examStudentId)
      } else {
        next.add(examStudentId)
      }
      return next
    })
  }

  return {
    reviewedAnswers,
    focusedAnswer,
    setFocusedExamStudentId,
    selectedExamStudentIds,
    toggleSelected,
    chooseAttempt,
    answerOrder,
    setAnswerOrder,
  }
}
