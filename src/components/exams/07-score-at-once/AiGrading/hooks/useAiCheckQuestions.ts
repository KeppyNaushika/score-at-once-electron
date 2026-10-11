/**
 * AI 採点チェック（docs/vlm-grading-design.md §3-10）の問いと答えを、最後に終わったチェックの実行と
 * 自分の今の採点から導き、決めたことを下書きとして AI の層へ書く。
 */

import { useMutation } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import { recordAiAttemptResponsesMutation } from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { toScoringStatus } from "@/types/scoringStatus.types"

import type { AiGradingAnswer, AiGradingRunRow } from "../types"
import { attemptResponsesForDecision } from "../utils/attemptResponseDecision"
import { buildCheckQuestioning } from "../utils/checkQuestions"
import type {
  QuestioningDecision,
  QuestioningScore,
  QuestioningStep,
} from "../utils/questioningSteps"

/** まだ終わっていない実行の状態 */
const ACTIVE_RUN_STATUSES: ReadonlySet<string> = new Set([
  "queued",
  "submitting",
  "in_progress",
])

/** running: チェックを実行中、idle: まだ実行していない、ready: 問いを出せる */
export type CheckStatus = "running" | "idle" | "ready"

/** 自分の今の採点（未採点・行が無ければ null） */
function ownScoreOfAnswers(
  answers: readonly AiGradingAnswer[]
): (examStudentId: string) => QuestioningScore | null {
  const scoreByExamStudentId = new Map(
    answers.flatMap((answer) => {
      const { questionScore } = answer
      if (!questionScore) return []
      const status = toScoringStatus(questionScore.status)
      if (status === "unscored") return []
      return [
        [
          answer.studentAnswerImage.examStudentId,
          { status, partialScore: questionScore.partialScore },
        ] as const,
      ]
    })
  )
  return (examStudentId) => scoreByExamStudentId.get(examStudentId) ?? null
}

interface UseAiCheckQuestionsOptions {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  runs: readonly AiGradingRunRow[]
  answers: readonly AiGradingAnswer[]
}

export function useAiCheckQuestions({
  examId,
  cropRegion,
  runs,
  answers,
}: UseAiCheckQuestionsOptions) {
  const checkRuns = runs.filter((run) => run.purpose === "check")
  const latestCheckRun = checkRuns.at(-1) ?? null
  const endedCheckRun = checkRuns.findLast((run) => run.status === "ended")
  const status: CheckStatus =
    latestCheckRun && ACTIVE_RUN_STATUSES.has(latestCheckRun.status)
      ? "running"
      : endedCheckRun
        ? "ready"
        : "idle"
  const ownScoreOf = useMemo(() => ownScoreOfAnswers(answers), [answers])
  const states = useMemo(
    () =>
      buildCheckQuestioning({
        checkRun: endedCheckRun ?? null,
        ownScoreOf,
        points: cropRegion.points,
      }),
    [endedCheckRun, ownScoreOf, cropRegion.points]
  )
  const { mutateAsync: recordAttemptResponses } = useMutation(
    recordAiAttemptResponsesMutation(examId, cropRegion.id)
  )
  const persistDecision = useCallback(
    (step: QuestioningStep, decision: QuestioningDecision) =>
      recordAttemptResponses({
        responses: attemptResponsesForDecision(step, decision),
      }),
    [recordAttemptResponses]
  )
  return { status, states, ownScoreOf, persistDecision }
}
