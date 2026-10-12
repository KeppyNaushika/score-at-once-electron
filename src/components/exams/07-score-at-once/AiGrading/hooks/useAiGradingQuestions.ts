/**
 * AI採点の問いかけ（docs/vlm-grading-design.md §3-5）の問いと答えを、届いた行から導き、
 * 決めたことを下書きとして AI の層へ書く。助言の欄・「その他」の欄の文は1打鍵ごとに、案ごとの行へ書く。
 */

import { useMutation, useQuery } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import {
  type AiRubricProposalRunRow,
  aiRubricProposalsQuery,
  discardAiRubricProposalInstructionDraftsMutation,
  recordAiAttemptResponsesMutation,
  recordAiRubricProposalDraftMutation,
  setAiQuestioningScoringMethodMutation,
  setAiRubricProposalAdviceDraftMutation,
  setAiRubricProposalInstructionDraftMutation,
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

  const { mutate: setAdviceDraft } = useMutation(
    setAiRubricProposalAdviceDraftMutation(examId, cropRegion.id)
  )
  /** 助言の欄の文を書く（案の問いだけ。1打鍵ごとに即時） */
  const persistAdviceText = useCallback(
    (step: QuestioningStep, adviceText: string) => {
      if (step.kind !== "proposal") return
      setAdviceDraft({ proposalId: step.id, adviceText })
    },
    [setAdviceDraft]
  )

  const { mutate: setInstructionDraft } = useMutation(
    setAiRubricProposalInstructionDraftMutation(examId, cropRegion.id)
  )
  /** 「その他」の欄の文を書く（案の問いだけ。1打鍵ごとに即時） */
  const persistInstructionText = useCallback(
    (step: QuestioningStep, instructionText: string) => {
      if (step.kind !== "proposal") return
      setInstructionDraft({ proposalId: step.id, instructionText })
    },
    [setInstructionDraft]
  )
  const { mutate: discardInstructionDrafts } = useMutation(
    discardAiRubricProposalInstructionDraftsMutation(examId, cropRegion.id)
  )
  /** 「その他」の欄の文を捨てる（確定のとき、「その他」を選んでいない案の問い） */
  const discardInstructionTexts = useCallback(
    (steps: readonly QuestioningStep[]) => {
      const proposalIds = steps
        .filter((step) => step.kind === "proposal")
        .map((step) => step.id)
      if (proposalIds.length > 0) discardInstructionDrafts({ proposalIds })
    },
    [discardInstructionDrafts]
  )

  return {
    status,
    proposalRun,
    proposalRuns,
    states,
    persistDecision,
    persistAdviceText,
    persistInstructionText,
    discardInstructionTexts,
  }
}
