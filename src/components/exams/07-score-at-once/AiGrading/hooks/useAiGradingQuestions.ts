/**
 * AI 採点の問いかけ（docs/vlm-grading-design.md §3-5）の問いと答えを、届いた行から導き、
 * 決めたことを下書きとして AI の層へ書く。
 */

import { useMutation, useQuery } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import {
  type AiRubricProposalRunRow,
  aiRubricProposalsQuery,
  recordAiAttemptResponsesMutation,
  recordAiRubricProposalDraftMutation,
  setAiQuestioningScoringMethodMutation,
} from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { toScoringMethod } from "@/types/rubric.types"

import type { AiGradingRunRow } from "../types"
import { attemptResponsesForDecision } from "../utils/attemptResponseDecision"
import { buildGradingQuestioning } from "../utils/gradingQuestions"
import {
  resolveQuestioningStatus,
  sourceGradeRunOf,
} from "../utils/questioningFlow"
import type {
  QuestioningDecision,
  QuestioningStep,
} from "../utils/questioningSteps"
import { latestEndedProposalRun } from "../utils/rubricProposals"

/** まだ届いていないときの空（毎回作り直さない） */
const NO_PROPOSAL_RUNS: AiRubricProposalRunRow[] = []

interface UseAiGradingQuestionsOptions {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  /** 設問の自分の実行（試行と、案の外の問いかけの答え付き） */
  runs: readonly AiGradingRunRow[]
}

export function useAiGradingQuestions({
  examId,
  cropRegion,
  runs,
}: UseAiGradingQuestionsOptions) {
  const { data: proposalRuns = NO_PROPOSAL_RUNS } = useQuery(
    aiRubricProposalsQuery(examId, cropRegion.id)
  )
  const status = resolveQuestioningStatus(runs, proposalRuns)
  const proposalRun = latestEndedProposalRun(proposalRuns)
  const scoringMethod = toScoringMethod(cropRegion.scoringMethod)
  const states = useMemo(
    () =>
      buildGradingQuestioning({
        proposalRun,
        sourceGradeRun: proposalRun
          ? sourceGradeRunOf(proposalRun, runs)
          : null,
        scoringMethod,
        points: cropRegion.points,
      }),
    [proposalRun, runs, scoringMethod, cropRegion.points]
  )

  const { mutateAsync: recordProposalDraft } = useMutation(
    recordAiRubricProposalDraftMutation(examId, cropRegion.id)
  )
  const { mutateAsync: recordAttemptResponses } = useMutation(
    recordAiAttemptResponsesMutation(examId, cropRegion.id)
  )
  const { mutateAsync: setScoringMethodDraft } = useMutation(
    setAiQuestioningScoringMethodMutation(examId, cropRegion.id)
  )

  const proposalRunId = proposalRun?.id ?? null
  const persistDecision = useCallback(
    async (step: QuestioningStep, decision: QuestioningDecision) => {
      switch (step.kind) {
        case "scoringMethod":
          if (proposalRunId === null || decision.kind !== "option") return
          return setScoringMethodDraft({
            runId: proposalRunId,
            scoringMethod: decision.optionKey,
          })
        case "proposal": {
          const attemptIdOf = new Map(
            step.members.map((member) => [
              member.examStudentId,
              member.attemptId,
            ])
          )
          return recordProposalDraft({
            proposalId: step.id,
            optionId: decision.kind === "option" ? decision.optionKey : null,
            freeText: decision.kind === "instruction" ? decision.text : "",
            manualScores:
              decision.kind === "manual"
                ? [...decision.scores].flatMap(([examStudentId, score]) => {
                    const attemptId = attemptIdOf.get(examStudentId)
                    return attemptId ? [{ attemptId, ...score }] : []
                  })
                : [],
          })
        }
        default:
          return recordAttemptResponses({
            responses: attemptResponsesForDecision(step, decision),
          })
      }
    },
    [
      proposalRunId,
      setScoringMethodDraft,
      recordProposalDraft,
      recordAttemptResponses,
    ]
  )

  return { status, proposalRun, proposalRuns, states, persistDecision }
}
