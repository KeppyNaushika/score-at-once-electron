/**
 * 問いかけ（docs/vlm-grading-design.md §3-5）の、作業場が持つ状態。
 *
 * どの案を問いかけているかは、左のパネル（答える）と中央の一覧（その案の答案を出す）の
 * 両方が読むので、作業場に置く。持つのは利用者の選択（開いた案・一覧を絞るか）だけで、
 * 今の案・状態・答案の並びは届いた行から毎回導く。
 */

import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"

import {
  type AiRubricProposalRunRow,
  aiRubricProposalsQuery,
} from "@/queries/aiGrading"

import type { AiGradingAnswer, AiGradingRunRow } from "../types"
import { studentDisplayName } from "../utils/answerDisplay"
import {
  nextUnansweredProposalId,
  resolveQuestioningStatus,
  sourceGradeRunOf,
} from "../utils/questioningFlow"
import {
  attemptsOutsideProposals,
  isProposalUnanswered,
  latestEndedProposalRun,
  orderMembersByConfidence,
  orderProposalsForQuestioning,
} from "../utils/rubricProposals"

/** まだ届いていないときの空（毎回作り直さない） */
const NO_PROPOSAL_RUNS: AiRubricProposalRunRow[] = []

/** 一覧に出す答案。今の案の答案か、どの案にも入らない答案か */
export type QuestioningGridTarget = "proposal" | "outside"

/** 開いているもの。null は「自動」（未回答の先頭の案。無ければまとめ） */
type OpenedEntry =
  { kind: "proposal"; proposalId: string } | { kind: "summary" }

interface UseAiQuestioningStateOptions {
  examId: string
  cropRegionId: string
  /** 設問の自分の実行（1段目・2段目） */
  runs: readonly AiGradingRunRow[]
  /** 設問の答案（氏名は匿名採点の置き換えを済ませた答案から引く） */
  answers: readonly AiGradingAnswer[]
}

export function useAiQuestioningState({
  examId,
  cropRegionId,
  runs,
  answers,
}: UseAiQuestioningStateOptions) {
  const { data: proposalRuns = NO_PROPOSAL_RUNS } = useQuery(
    aiRubricProposalsQuery(examId, cropRegionId)
  )
  const [opened, setOpened] = useState<OpenedEntry | null>(null)
  const [isGridNarrowed, setIsGridNarrowed] = useState(true)
  const [gridTarget, setGridTarget] =
    useState<QuestioningGridTarget>("proposal")

  const status = resolveQuestioningStatus(runs, proposalRuns)
  const proposalRun = latestEndedProposalRun(proposalRuns)
  const orderedProposals = useMemo(
    () =>
      proposalRun
        ? orderProposalsForQuestioning(proposalRun.rubricProposals)
        : [],
    [proposalRun]
  )
  const unansweredCount = orderedProposals.filter(isProposalUnanswered).length

  const openedProposal =
    opened?.kind === "proposal"
      ? orderedProposals.find((proposal) => proposal.id === opened.proposalId)
      : undefined
  /** いま問いかけている案（まとめを開いている・全部答えたなら null） */
  const currentProposal =
    openedProposal ??
    (opened?.kind === "summary"
      ? null
      : (orderedProposals.find(isProposalUnanswered) ?? null))

  const outsideAttempts = useMemo(() => {
    if (!proposalRun) return []
    const gradeRun = sourceGradeRunOf(proposalRun, runs)
    return gradeRun
      ? attemptsOutsideProposals(gradeRun.attempts, proposalRun.rubricProposals)
      : []
  }, [proposalRun, runs])

  const nameByExamStudentId = useMemo(
    () =>
      new Map(
        answers.map((answer) => [
          answer.studentAnswerImage.examStudentId,
          studentDisplayName(answer.studentAnswerImage),
        ])
      ),
    [answers]
  )
  /** 受験者の表示名（AI には送っていない。匿名採点ならその仮の名前） */
  const nameOf = useCallback(
    (examStudentId: string) =>
      nameByExamStudentId.get(examStudentId) ?? "（答案なし）",
    [nameByExamStudentId]
  )

  /** 今の案の答案（確信度の低い順。同じ受験者は1回） */
  const currentMemberExamStudentIds = useMemo(
    () =>
      currentProposal
        ? [
            ...new Set(
              orderMembersByConfidence(currentProposal.members).map(
                (member) => member.attempt.examStudentId
              )
            ),
          ]
        : [],
    [currentProposal]
  )
  const outsideExamStudentIds = useMemo(
    () => [
      ...new Set(
        orderMembersByConfidence(
          outsideAttempts.map((attempt) => ({ attempt }))
        ).map(({ attempt }) => attempt.examStudentId)
      ),
    ],
    [outsideAttempts]
  )

  /** 中央の一覧に出す答案（この順で）。絞らないなら null */
  const gridExamStudentIds: readonly string[] | null = !isGridNarrowed
    ? null
    : gridTarget === "outside"
      ? outsideExamStudentIds
      : currentProposal
        ? currentMemberExamStudentIds
        : null

  const openProposal = useCallback((proposalId: string) => {
    setOpened({ kind: "proposal", proposalId })
    setGridTarget("proposal")
  }, [])
  /** 答えた案の次へ（全部答えていればまとめへ） */
  const advanceFrom = useCallback(
    (answeredProposalId: string) => {
      const nextId = nextUnansweredProposalId(
        orderedProposals,
        answeredProposalId
      )
      setOpened(
        nextId ? { kind: "proposal", proposalId: nextId } : { kind: "summary" }
      )
      setGridTarget("proposal")
    },
    [orderedProposals]
  )
  const showSummary = useCallback(() => setOpened({ kind: "summary" }), [])

  return {
    status,
    proposalRun,
    orderedProposals,
    unansweredCount,
    currentProposal,
    currentMemberExamStudentIds,
    outsideAttempts,
    outsideExamStudentIds,
    nameOf,
    openProposal,
    advanceFrom,
    showSummary,
    isGridNarrowed,
    setIsGridNarrowed,
    gridTarget,
    setGridTarget,
    gridExamStudentIds,
  }
}

export type AiQuestioningState = ReturnType<typeof useAiQuestioningState>
