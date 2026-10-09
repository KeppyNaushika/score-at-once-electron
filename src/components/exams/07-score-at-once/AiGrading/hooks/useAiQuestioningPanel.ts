/**
 * 問いかけのパネル（docs/vlm-grading-design.md §3-5・§11-4）の操作。
 *
 * 選択の場面（`useChoiceScene`）で、並びは開いているものによって変わる。
 * - **採点方式の問いかけ**（設問が直接採点のとき、最初の問いかけの前）: 減点方式・加点方式。
 *   直接採点のままでは項目を当てても点が計算されないので、答える前に決める
 * - **案の問いかけ**: 案の選択肢。数字で選び（焦点を移す）、Enter で答えて次の案へ。
 *   0 で「その他」の欄に入り、欄の Enter で指示を送って次の案へ
 *
 * 答えるのは `useAiProposalAnswering`（項目を作って当て、点を計算して書き、朱書きを合わせる）。
 */

import { useMutation } from "@tanstack/react-query"
import { useMemo, useRef, useState } from "react"

import { useChoiceScene } from "@/components/exams/07-score-at-once/hooks/useChoiceScene"
import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { setScoringMethodMutation } from "@/queries/rubric"
import type { QuestionScoreRow } from "@/queries/scoring"
import { type ScoringMethod, toScoringMethod } from "@/types/rubric.types"

import { useRubricAdviceSync } from "../../Rubric/hooks/useRubricAdviceSync"
import { useRubricQuestion } from "../../Rubric/hooks/useRubricQuestion"
import { useRubricRecalculation } from "../../Rubric/hooks/useRubricRecalculation"
import { useScoringKeysPausedWhile } from "../../Rubric/hooks/useScoringKeysPausedWhile"
import { SCORING_METHOD_LABELS } from "../../Rubric/utils/rubricEffectLabel"
import { recommendedScoringMethodOf } from "../utils/questioningFlow"
import {
  type AiRubricProposalRow,
  latestProposalResponse,
  planProposalAnswer,
} from "../utils/rubricProposals"
import { useAiProposalAnswering } from "./useAiProposalAnswering"
import type { AiQuestioningState } from "./useAiQuestioningState"

/** 採点方式の問いかけの選択肢（この順で 1・2） */
export const QUESTIONING_SCORING_METHODS = [
  "deduction",
  "addition",
] as const satisfies readonly Exclude<ScoringMethod, "points">[]

/** 案ごとに書きかけの文（別の案へ移ったら、その案の初めの値に戻る） */
interface ProposalDraft {
  proposalId: string
  text: string
}

/** 案を開いたときに焦点を置く選択肢: いまの答え、無ければ推奨 */
function initialOptionIndexOf(proposal: AiRubricProposalRow | null): number {
  if (!proposal) return 0
  const latestOptionId = latestProposalResponse(proposal)?.optionId
  const answeredIndex = proposal.options.findIndex(
    (option) => option.id === latestOptionId
  )
  if (answeredIndex >= 0) return answeredIndex
  return Math.max(
    0,
    proposal.options.findIndex((option) => option.recommended)
  )
}

interface UseAiQuestioningPanelOptions {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  currentUserId: string
  questionScores: readonly QuestionScoreRow[]
  studentAnswerImages: readonly StudentAnswerImageWithExamStudents[]
  pageSize: string
  questioning: AiQuestioningState
  /** 点を書いた答案を一覧に残す（絞り込みから急に消えないように） */
  onScored: (examStudentIds: string[]) => void
  /** 助言の朱書きを書いた（一覧の注釈を取り直す合図） */
  onAnnotationsChanged?: () => void
}

export function useAiQuestioningPanel({
  examId,
  cropRegion,
  currentUserId,
  questionScores,
  studentAnswerImages,
  pageSize,
  questioning,
  onScored,
  onAnnotationsChanged,
}: UseAiQuestioningPanelOptions) {
  const scoringMethod = toScoringMethod(cropRegion.scoringMethod)
  const { rubricItems, ownCellOf } = useRubricQuestion({
    examId,
    cropRegionId: cropRegion.id,
    currentUserId,
    questionScores,
  })
  const adviceSync = useRubricAdviceSync({
    examId,
    cropRegion,
    pageSize,
    studentAnswerImages,
    onAnnotationsChanged,
  })
  const { runWithRecalculation, pending, cancel } = useRubricRecalculation({
    examId,
    cropRegionId: cropRegion.id,
    currentUserId,
  })
  useScoringKeysPausedWhile(pending !== null)
  const { answer } = useAiProposalAnswering({
    examId,
    cropRegion,
    rubricItems,
    ownCellOf,
    syncAdviceRows: adviceSync.syncRows,
    runWithRecalculation,
    onScored,
  })
  const { mutateAsync: setScoringMethod } = useMutation(
    setScoringMethodMutation(examId)
  )

  const { currentProposal } = questioning
  /** 直接採点の設問では、案に答える前に採点方式を問いかける */
  const asksScoringMethod =
    scoringMethod === "points" && currentProposal !== null
  const recommendedMethod = recommendedScoringMethodOf(
    questioning.orderedProposals
  )
  const livingRubricItemIds = useMemo(
    () => new Set(rubricItems.map((rubricItem) => rubricItem.id)),
    [rubricItems]
  )

  const [adviceDraft, setAdviceDraft] = useState<ProposalDraft | null>(null)
  const [otherDraft, setOtherDraft] = useState<ProposalDraft | null>(null)
  const otherTextRef = useRef<HTMLTextAreaElement | null>(null)
  const draftTextOf = (draft: ProposalDraft | null, fallback: string) =>
    draft && draft.proposalId === currentProposal?.id ? draft.text : fallback
  const adviceText = draftTextOf(
    adviceDraft,
    currentProposal?.adviceDraft ?? ""
  )
  const otherText = draftTextOf(otherDraft, "")

  /** 新しく項目を作る答えになるか（助言の文案を直せるのはこのときだけ） */
  const createsRubricItem =
    currentProposal !== null &&
    planProposalAnswer(
      currentProposal,
      { kind: "option", optionId: "" },
      livingRubricItemIds
    ).kind === "create"

  const changeScoringMethod = (nextMethod: Exclude<ScoringMethod, "points">) =>
    runWithRecalculation({
      transform: (source) => ({ ...source, scoringMethod: nextMethod }),
      title: "採点方式を変えますか",
      description: `${cropRegion.label} を「${SCORING_METHOD_LABELS[nextMethod]}」にします。`,
      confirmLabel: "変える",
      change: () =>
        setScoringMethod({
          cropRegionId: cropRegion.id,
          scoringMethod: nextMethod,
        }),
    })

  const answerOption = (proposal: AiRubricProposalRow, optionIndex: number) => {
    const option = proposal.options[optionIndex]
    if (!option) return
    const editedAdvice =
      createsRubricItem && adviceText !== proposal.adviceDraft
        ? { adviceText }
        : {}
    answer(proposal, { kind: "option", optionId: option.id, ...editedAdvice })
    questioning.advanceFrom(proposal.id)
  }

  const answerOther = (proposal: AiRubricProposalRow) => {
    const freeText = otherText.trim()
    if (freeText === "") return
    answer(proposal, { kind: "other", freeText })
    setOtherDraft(null)
    questioning.advanceFrom(proposal.id)
  }

  const choiceScene = useChoiceScene({
    entryCount: asksScoringMethod
      ? QUESTIONING_SCORING_METHODS.length
      : (currentProposal?.options.length ?? 0),
    // 数字は焦点を移すだけ（選んだ選択肢を見比べてから Enter で答える）
    onSelect: () => undefined,
    onOther: () => {
      if (asksScoringMethod || !currentProposal) return
      otherTextRef.current?.focus()
    },
    onConfirm: (focusedIndex) => {
      if (asksScoringMethod) {
        void changeScoringMethod(QUESTIONING_SCORING_METHODS[focusedIndex])
        return
      }
      if (currentProposal) answerOption(currentProposal, focusedIndex)
    },
  })

  // 案（または採点方式の問いかけ）が変わったら、焦点をいまの答え（無ければ推奨）の選択肢に置く
  const focusKey = asksScoringMethod
    ? `method:${cropRegion.id}`
    : (currentProposal?.id ?? null)
  const [focusedFor, setFocusedFor] = useState<string | null>(null)
  if (focusKey !== focusedFor) {
    setFocusedFor(focusKey)
    choiceScene.setFocusedIndex(
      asksScoringMethod
        ? QUESTIONING_SCORING_METHODS.indexOf(recommendedMethod)
        : initialOptionIndexOf(currentProposal)
    )
  }

  const setAdviceText = (text: string) => {
    if (currentProposal)
      setAdviceDraft({ proposalId: currentProposal.id, text })
  }
  const setOtherText = (text: string) => {
    if (currentProposal) setOtherDraft({ proposalId: currentProposal.id, text })
  }

  return {
    scoringMethod,
    rubricItems,
    choiceScene,
    asksScoringMethod,
    recommendedMethod,
    changeScoringMethod,
    createsRubricItem,
    adviceText,
    setAdviceText,
    otherText,
    setOtherText,
    otherTextRef,
    answerOption,
    answerOther,
    recalculation: { pending, cancel },
  }
}
