import { useMemo, useState } from "react"

import type { AiGradingStage1Purpose } from "@/types/aiGrading.types"

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
  /** いま開いている AI 採点・AI チェックのタブの目的（採点指示のタブなら null）。選んだ実行はその目的のものだけが効く */
  purpose: AiGradingStage1Purpose | null
  /** 並べ方（設問をまたいで残すので、AI採点モードの根から受け取る） */
  answerOrder: AnswerOrder
}

/**
 * 利用者の選択（実行の履歴で選んだ実行）と、そこから導く印。持つのは利用者が選んだものだけで、
 * 表示は毎回導く。表示する試行は「選んだ実行の試行 → 最新」の順で決まる
 */
export function useAiAnswerReviewState({
  answers,
  selectedPromptId,
  points,
  runs,
  currentUserId,
  purpose,
  answerOrder,
}: UseAiAnswerReviewStateOptions) {
  const [chosenRunIdState, setChosenRunIdState] = useState<string | null>(null)
  // 選んだ実行が消えた・いまのタブの目的でなければ最新に戻して見せる（選択は書き戻さない）
  const chosenRunId = resolveChosenRunId(
    chosenRunIdState,
    runs,
    currentUserId,
    purpose
  )

  const reviewedAnswers = useMemo(
    () =>
      orderReviewedAnswers(
        answers.map((answer) => ({
          answer,
          review: reviewAnswer(answer, {
            chosenRunId,
            selectedPromptId,
            points,
          }),
        })),
        answerOrder
      ),
    [answers, chosenRunId, selectedPromptId, points, answerOrder]
  )

  /** 一覧に出す実行を選ぶ（null は最新） */
  const chooseRun = (runId: string | null) => setChosenRunIdState(runId)

  return {
    reviewedAnswers,
    chosenRunId,
    chooseRun,
  }
}
