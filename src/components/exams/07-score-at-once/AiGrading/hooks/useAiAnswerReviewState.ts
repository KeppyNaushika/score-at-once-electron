import { useMemo, useState } from "react"

import type { AiGradingAnswer, AiGradingRunRow } from "../types"
import {
  type AnswerOrder,
  orderReviewedAnswers,
  reviewAnswer,
} from "../utils/answerReview"
import { resolveChosenRunId } from "../utils/runHistory"

interface UseAiAnswerReviewStateOptions {
  answers: AiGradingAnswer[]
  selectedPromptId: string | null
  points: number | null
  /** 設問の自分の実行（実行の履歴で選んだ実行がまだあるかを見る） */
  runs: readonly AiGradingRunRow[]
  currentUserId: string
  /** 並べ方（設問をまたいで残すので、AI採点モードの根から受け取る） */
  answerOrder: AnswerOrder
}

/**
 * 利用者の選択（実行の履歴で選んだ実行・答案ごとに `<` `>` で選んだ試行）と、
 * そこから導く印。持つのは利用者が選んだものだけで、表示は毎回導く。
 *
 * 表示する試行は「`<` `>` の選択 → 選んだ実行の試行 → 最新」の順で決まる。実行を選び直すと
 * `<` `>` の選択は捨てる（選んだ実行が全員に効いて見えるように）
 */
export function useAiAnswerReviewState({
  answers,
  selectedPromptId,
  points,
  runs,
  currentUserId,
  answerOrder,
}: UseAiAnswerReviewStateOptions) {
  const [chosenAttemptIdByExamStudentId, setChosenAttemptIdByExamStudentId] =
    useState<ReadonlyMap<string, string>>(new Map())
  const [chosenRunIdState, setChosenRunIdState] = useState<string | null>(null)
  // 選んだ実行が消えたら最新に戻して見せる（選択は書き戻さない）
  const chosenRunId = resolveChosenRunId(chosenRunIdState, runs, currentUserId)

  const reviewedAnswers = useMemo(
    () =>
      orderReviewedAnswers(
        answers.map((answer) => ({
          answer,
          review: reviewAnswer(answer, {
            chosenAttemptIdByExamStudentId,
            chosenRunId,
            selectedPromptId,
            points,
          }),
        })),
        answerOrder
      ),
    [
      answers,
      chosenAttemptIdByExamStudentId,
      chosenRunId,
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

  /** 一覧に出す実行を選ぶ（null は最新）。答案ごとの `<` `>` の選択は捨てる */
  const chooseRun = (runId: string | null) => {
    setChosenRunIdState(runId)
    setChosenAttemptIdByExamStudentId(new Map())
  }

  return {
    reviewedAnswers,
    chooseAttempt,
    chosenRunId,
    chooseRun,
  }
}
