/**
 * 問いかけ（docs/vlm-grading-design.md §3-5・§3-10）を、左パネルと中央の一覧で分け持つための束ね。
 *
 * 問い・選択肢・記録・見直しは左パネル（AI 採点／AI 採点チェックのタブ）に出し、中央は
 * いつもの答案の一覧のまま。ここは両方が読むものを作業場に1つだけ持つ:
 * - 流れ（`useQuestioningFlow`）・確定（`useQuestioningCommit`）・1件ずつ採点のキー
 * - 一覧を、いまの問いの答案に絞る（確信度の低い順。スイッチで外せる）
 * - 確定すると付く予定の点（一覧のマスに斜線で出す）と、1件ずつ採点の焦点の答案
 *
 * タブを閉じているあいだ（mode が null）は、キーも絞り込みも斜線も効かせない。
 */

import { useCallback, useMemo, useState } from "react"

import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { toScoringMethod } from "@/types/rubric.types"

import { SCORING_METHOD_STEP_ID } from "../utils/gradingQuestions"
import { draftScoresOf } from "../utils/questioningDraftScores"
import {
  type QuestioningMode,
  summarizeQuestioningReview,
} from "../utils/questioningReview"
import type {
  QuestioningDecision,
  QuestioningScore,
  QuestioningStep,
  QuestioningStepState,
} from "../utils/questioningSteps"
import type { AiRubricProposalRow } from "../utils/rubricProposals"
import { useQuestioningCommit } from "./useQuestioningCommit"
import { type QuestioningEntry, useQuestioningFlow } from "./useQuestioningFlow"
import { useQuestioningManualKeys } from "./useQuestioningManualKeys"

const NO_STATES: QuestioningStepState[] = []

interface UseAiQuestioningOptions {
  /** 開いている問いかけのタブ。問いかけのタブでなければ null */
  mode: QuestioningMode | null
  examId: string
  cropRegion: QuestionAnswerRegionRow
  currentUserId: string
  pageSize: string
  studentAnswerImages: readonly StudentAnswerImageWithExamStudents[]
  /** 開いているタブの問いと、いまの答え */
  states: readonly QuestioningStepState[]
  persistDecision: (
    step: QuestioningStep,
    decision: QuestioningDecision
  ) => Promise<unknown>
  ownScoreOf: (examStudentId: string) => QuestioningScore | null
  /** AI 採点の案（選び直しの洗い出しと、点を加減する選択肢の点に使う）。チェックでは空 */
  proposals: readonly AiRubricProposalRow[]
  onAnnotationsChanged?: () => void
}

/** 焦点のある選択肢で決めたとしたときの答え（「その他」は点を付けないので null） */
function previewDecisionOf(
  step: QuestioningStep,
  entry: QuestioningEntry | null,
  manualScores: ReadonlyMap<string, QuestioningScore> | null
): QuestioningDecision | null {
  if (!entry) return null
  switch (entry.kind) {
    case "option": {
      const option = step.options[entry.optionIndex]
      return option ? { kind: "option", optionKey: option.key } : null
    }
    case "manual":
      return { kind: "manual", scores: manualScores ?? new Map() }
    case "other":
      return null
  }
}

export function useAiQuestioning({
  mode,
  examId,
  cropRegion,
  currentUserId,
  pageSize,
  studentAnswerImages,
  states: modeStates,
  persistDecision,
  ownScoreOf,
  proposals,
  onAnnotationsChanged,
}: UseAiQuestioningOptions) {
  const isEnabled = mode !== null
  const states = isEnabled ? modeStates : NO_STATES
  const scopeKey = mode ?? "none"

  const [hasJustCommitted, setHasJustCommitted] = useState(false)
  const [committedScope, setCommittedScope] = useState(scopeKey)
  if (committedScope !== scopeKey) {
    setCommittedScope(scopeKey)
    setHasJustCommitted(false)
  }
  const persistAndReopen = useCallback(
    (step: QuestioningStep, decision: QuestioningDecision) => {
      setHasJustCommitted(false)
      return persistDecision(step, decision)
    },
    [persistDecision]
  )
  const flow = useQuestioningFlow({
    states,
    persistDecision: persistAndReopen,
    isEnabled,
    scopeKey,
  })
  const { commit, isCommitting, recalculation } = useQuestioningCommit({
    examId,
    cropRegion,
    currentUserId,
    pageSize,
    studentAnswerImages,
    proposals,
    onAnnotationsChanged,
    onCommitted: () => setHasJustCommitted(true),
  })

  const { currentState, manualDraft } = flow
  const isManualActive = isEnabled && flow.isManualActive
  const cursorMember =
    isManualActive && currentState && manualDraft
      ? (currentState.step.members[manualDraft.cursor] ?? null)
      : null
  const partialScore = useQuestioningManualKeys({
    isActive: isManualActive,
    cropRegion,
    cursorExamStudentId: cursorMember?.examStudentId ?? null,
    cursorScore: cursorMember
      ? (manualDraft?.scores.get(cursorMember.examStudentId) ?? null)
      : null,
    onMove: flow.moveManualCursor,
    onScore: flow.scoreManualCursor,
  })

  // ── 中央の一覧とのつなぎ ─────────────────────────────
  const cursorExamStudentId = cursorMember?.examStudentId ?? null
  const cursorSelectedIds = useMemo(
    () => new Set(cursorExamStudentId === null ? [] : [cursorExamStudentId]),
    [cursorExamStudentId]
  )
  const [isGridNarrowed, setIsGridNarrowed] = useState(true)
  const currentMembers = currentState?.step.members ?? null
  /** 一覧を絞る答案（いまの問いの答案を確信度の低い順に）。絞らないなら null */
  const pinnedExamStudentIds = useMemo(
    () =>
      isGridNarrowed && currentMembers && currentMembers.length > 0
        ? currentMembers.map((member) => member.examStudentId)
        : null,
    [isGridNarrowed, currentMembers]
  )

  const pointDeltaByOptionId = useMemo(
    () =>
      new Map(
        proposals.flatMap((proposal) =>
          proposal.options.flatMap((option) =>
            option.effectKind === "adjust" && option.pointDelta !== null
              ? [[option.id, option.pointDelta] as const]
              : []
          )
        )
      ),
    [proposals]
  )
  const focusedEntry = flow.entries[flow.focusedIndex] ?? null
  const draftScores = draftScoresOf({
    states,
    mode: mode ?? "grade",
    ownScoreOf,
    preview: currentState
      ? {
          stepId: currentState.step.id,
          decision: previewDecisionOf(
            currentState.step,
            focusedEntry,
            manualDraft?.scores ?? null
          ),
        }
      : null,
    pointDeltaOf: (optionKey) => pointDeltaByOptionId.get(optionKey) ?? null,
    scoringMethod: toScoringMethod(cropRegion.scoringMethod),
    points: cropRegion.points,
  })

  const summary = summarizeQuestioningReview(
    states,
    mode ?? "grade",
    ownScoreOf
  )
  const isMethodUnanswered = states.some(
    (state) =>
      state.step.id === SCORING_METHOD_STEP_ID && state.decision === null
  )
  const committedInstructionMembers = [
    ...new Set(
      states.flatMap((state) =>
        state.isCommitted && state.decision?.kind === "instruction"
          ? state.step.members.map((member) => member.examStudentId)
          : []
      )
    ),
  ]

  return {
    mode,
    states,
    flow,
    commit,
    isCommitting,
    recalculation,
    hasJustCommitted,
    partialScore,
    summary,
    isMethodUnanswered,
    committedInstructionMembers,
    isGridNarrowed,
    setIsGridNarrowed,
    pinnedExamStudentIds,
    /** 受験者 → 確定すると付く予定の状態（一覧のマスに斜線で重ねる） */
    draftStatusByExamStudentId: new Map(
      [...draftScores].map(([examStudentId, score]) => [
        examStudentId,
        score.status,
      ])
    ),
    /**
     * 1件ずつ自分で採点しているあいだ、一覧の選択の代わりに使うもの: 焦点の答案を選んでいる
     * ものとして出し、マスを選ぶと焦点をその答案へ移す（問いの外の答案へは移らない）。それ以外は null
     */
    gridSelectionOverride: cursorMember
      ? {
          selectedIds: cursorSelectedIds,
          select: flow.placeManualCursor,
        }
      : null,
    ownScoreOf,
  }
}

export type AiQuestioning = ReturnType<typeof useAiQuestioning>
