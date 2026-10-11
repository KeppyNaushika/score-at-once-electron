/**
 * AI 採点の問いかけ（docs/vlm-grading-design.md §3-5）の問いを、届いた行から組み立てる。
 *
 * 並び: 採点方式（直接採点の設問に点を加減する案があるときだけ）→ 2段目の項目の案（既存の項目に
 * 当たる案 → 判定を決める案 → 点を加減する案）→ どの案にも入らない答案。
 * 答えは AI の層の答えの行（案への答え・答案ごとの答え・実行の採点方式の下書き）から導く。
 */

import type { ScoringMethod } from "@/types/rubric.types"
import { toScoringStatus } from "@/types/scoringStatus.types"

import { rubricEffectLabel } from "../../Rubric/utils/rubricEffectLabel"
import { SCORING_METHOD_LABELS } from "../../Rubric/utils/rubricEffectLabel"
import type { AiGradingRunRow } from "../types"
import {
  decisionFromAttemptResponses,
  KEEP_OPTION_KEY,
  latestAttemptResponse,
} from "./attemptResponseDecision"
import { recommendedScoringMethodOf } from "./questioningFlow"
import {
  describeScore,
  type QuestioningDecision,
  type QuestioningMember,
  type QuestioningStep,
  type QuestioningStepState,
} from "./questioningSteps"
import {
  type AiRubricProposalRow,
  attemptsOutsideProposals,
  latestProposalResponse,
  optionEffectOf,
  orderMembersByConfidence,
  orderProposalsForQuestioning,
  proposalAnswerKindOf,
} from "./rubricProposals"

/** 採点方式の問いの id（行の id ではない） */
export const SCORING_METHOD_STEP_ID = "scoringMethod"
/** どの案にも入らない答案の問いの id */
export const OUTSIDE_STEP_ID = "outside"

/** 採点方式の問いの選択肢（この順） */
export const QUESTIONING_SCORING_METHODS = ["deduction", "addition"] as const
export type QuestioningScoringMethod =
  (typeof QUESTIONING_SCORING_METHODS)[number]

export const isQuestioningScoringMethod = (
  candidate: string
): candidate is QuestioningScoringMethod =>
  QUESTIONING_SCORING_METHODS.some((method) => method === candidate)

/** 答案を受験者ごとに1回ずつ、確信度の低い順に */
function membersOf(
  attempts: readonly {
    id: string
    examStudentId: string
    confidence: string
  }[]
): QuestioningMember[] {
  const seen = new Set<string>()
  return orderMembersByConfidence(attempts.map((attempt) => ({ attempt })))
    .filter(({ attempt }) => {
      if (seen.has(attempt.examStudentId)) return false
      seen.add(attempt.examStudentId)
      return true
    })
    .map(({ attempt }) => ({
      examStudentId: attempt.examStudentId,
      attemptId: attempt.id,
    }))
}

/** 案に点を加減する選択肢があるか（直接採点のままでは計算できない） */
const hasAdjustOption = (proposal: Pick<AiRubricProposalRow, "options">) =>
  proposal.options.some((option) => option.effectKind === "adjust")

/** 案1つの問い */
export function proposalStepOf(
  proposal: AiRubricProposalRow,
  points: number | null
): QuestioningStep {
  const members = membersOf(proposal.members.map((member) => member.attempt))
  return {
    id: proposal.id,
    kind: "proposal",
    title: `${proposal.label}（${members.length}件）`,
    question: "この答案をどう採点しますか？",
    detail: [
      proposal.description,
      proposal.adviceDraft ? `助言：「${proposal.adviceDraft}」` : "",
    ]
      .filter((text) => text !== "")
      .join("　"),
    members,
    options: proposal.options.map((option) => {
      const setStatus =
        option.effectKind === "set" && option.setStatus !== null
          ? toScoringStatus(option.setStatus)
          : null
      const score = setStatus
        ? { status: setStatus, partialScore: option.setScore }
        : null
      return {
        key: option.id,
        label: score
          ? describeScore(score, points)
          : rubricEffectLabel(optionEffectOf(option)),
        description: option.rationale,
        recommended: option.recommended,
        score,
        writesScore: true,
      }
    }),
    allowsManual: true,
    allowsInstruction: true,
  }
}

/** 案への最新の答え（下書きか確定済み）から、決めたことを読む */
export function proposalDecisionOf(
  proposal: AiRubricProposalRow,
  step: Pick<QuestioningStep, "members">
): Omit<QuestioningStepState, "step"> {
  const latest = latestProposalResponse(proposal)
  if (!latest) {
    return {
      decision: null,
      isCommitted: false,
      draftProposalResponseId: null,
      draftAttemptResponseIds: [],
    }
  }
  const examStudentIdByAttemptId = new Map(
    step.members.map((member) => [member.attemptId, member.examStudentId])
  )
  const decision = ((): QuestioningDecision => {
    switch (proposalAnswerKindOf(latest)) {
      case "option":
        return { kind: "option", optionKey: latest.optionId ?? "" }
      case "instruction":
        return { kind: "instruction", text: latest.freeText }
      case "manual":
        return {
          kind: "manual",
          scores: new Map(
            latest.scores.flatMap((score) => {
              const examStudentId = examStudentIdByAttemptId.get(
                score.attemptId
              )
              return examStudentId
                ? [
                    [
                      examStudentId,
                      {
                        status: toScoringStatus(score.status),
                        partialScore: score.partialScore,
                      },
                    ] as const,
                  ]
                : []
            })
          ),
        }
    }
  })()
  const isCommitted = latest.committedAt !== null
  return {
    decision,
    isCommitted,
    draftProposalResponseId: isCommitted ? null : latest.id,
    draftAttemptResponseIds: [],
  }
}

interface BuildGradingQuestioningInput {
  /** 問いかけに使う2段目の実行（無ければ問いは無い） */
  proposalRun: {
    questioningScoringMethod: string
    rubricProposals: AiRubricProposalRow[]
  } | null
  /** 2段目の元になった1段目の実行（どの案にも入らない答案を求める） */
  sourceGradeRun: Pick<AiGradingRunRow, "attempts"> | null
  scoringMethod: ScoringMethod
  points: number | null
}

/** AI 採点の問いを、問いかける順に、いまの答え付きで */
export function buildGradingQuestioning({
  proposalRun,
  sourceGradeRun,
  scoringMethod,
  points,
}: BuildGradingQuestioningInput): QuestioningStepState[] {
  if (!proposalRun) return []
  const proposals = orderProposalsForQuestioning(proposalRun.rubricProposals)
  const states: QuestioningStepState[] = []

  if (scoringMethod === "points" && proposals.some(hasAdjustOption)) {
    const recommended = recommendedScoringMethodOf(proposals)
    const draftMethod = proposalRun.questioningScoringMethod
    states.push({
      step: {
        id: SCORING_METHOD_STEP_ID,
        kind: "scoringMethod",
        title: "採点方式",
        question:
          "点を加減する案があります。この設問の採点方式をどうしますか？（確定のときに変えます）",
        detail:
          "直接採点のまま AI の判定をそのまま点にするときは「採点反映」のタブで採用します。",
        members: [],
        options: QUESTIONING_SCORING_METHODS.map((method) => ({
          key: method,
          label: SCORING_METHOD_LABELS[method],
          description:
            method === "deduction"
              ? "配点から、当たった項目の減点を引きます"
              : "0点から、当たった項目の加点を足します",
          recommended: method === recommended,
          score: null,
          writesScore: false,
        })),
        allowsManual: false,
        allowsInstruction: false,
      },
      decision: isQuestioningScoringMethod(draftMethod)
        ? { kind: "option", optionKey: draftMethod }
        : null,
      isCommitted: false,
      draftProposalResponseId: null,
      draftAttemptResponseIds: [],
    })
  }

  proposals.forEach((proposal) => {
    const step = proposalStepOf(proposal, points)
    states.push({ step, ...proposalDecisionOf(proposal, step) })
  })

  const outsideAttempts = sourceGradeRun
    ? attemptsOutsideProposals(sourceGradeRun.attempts, proposals)
    : []
  if (outsideAttempts.length > 0) {
    const members = membersOf(outsideAttempts)
    const step: QuestioningStep = {
      id: OUTSIDE_STEP_ID,
      kind: "outside",
      title: `どの案にも入らない答案（${members.length}件）`,
      question:
        "AI はこの答案を、どの案にも入れられず、既存の項目にも当てられませんでした。",
      detail: "",
      members,
      options: [
        {
          key: KEEP_OPTION_KEY,
          label: "このままにする",
          description: "あとで採点する",
          recommended: true,
          score: null,
          writesScore: false,
        },
      ],
      allowsManual: true,
      allowsInstruction: false,
    }
    const attemptById = new Map(
      outsideAttempts.map((attempt) => [attempt.id, attempt])
    )
    const read = decisionFromAttemptResponses(step, (attemptId) => {
      const attempt = attemptById.get(attemptId)
      return attempt ? latestAttemptResponse(attempt) : undefined
    })
    states.push({ step, ...read, draftProposalResponseId: null })
  }
  return states
}
