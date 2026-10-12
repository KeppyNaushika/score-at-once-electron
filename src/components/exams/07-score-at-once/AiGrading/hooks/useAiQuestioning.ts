/**
 * 問いかけ（docs/vlm-grading-design.md §3-5・§3-10）を、左パネルと中央の一覧で分け持つための束ね。
 *
 * 問い・選択肢・記録・見直しは左パネル（AI採点／AIチェックのタブ）に出し、中央は
 * いつもの答案の一覧のまま。ここは両方が読むものを作業場に1つだけ持つ:
 * - 流れ（`useQuestioningFlow`）・確定（`useQuestioningCommit`）・自分で採点のキー
 * - 一覧を、いまの問いの答案に絞る（確信度の低い順。スイッチで外せる）
 * - 確定すると付く予定の点（一覧のマスに斜線で出す）と、自分で採点の焦点の答案
 *
 * タブを閉じているあいだ（mode が null）は、キーも絞り込みも斜線も効かせない。
 */

import { useCallback, useMemo, useState } from "react"

import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { toScoringMethod } from "@/types/rubric.types"

import type { ScaleQuestionState } from "../../ScaleLevel/hooks/useScaleScoringGate"
import type { AdviceTextPreviewRequest } from "../utils/adviceTextPreview"
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
  /** 決めたことを下書きとして書く */
  persistDecision: (
    step: QuestioningStep,
    decision: QuestioningDecision
  ) => Promise<unknown>
  /** 助言の欄の文を書く（1打鍵ごと。助言の無い問いでは呼ばれない） */
  persistAdviceText: (step: QuestioningStep, adviceText: string) => void
  /** 「その他」の欄の文を書く（1打鍵ごと。欄の無い問いでは呼ばれない） */
  persistInstructionText: (
    step: QuestioningStep,
    instructionText: string
  ) => void
  /** 「その他」の欄の文を捨てる（確定のとき、「その他」を選んでいない問い） */
  discardInstructionTexts: (steps: readonly QuestioningStep[]) => void
  ownScoreOf: (examStudentId: string) => QuestioningScore | null
  /** AI採点の案（選び直しの洗い出しと、点を加減する選択肢の点に使う）。チェックでは空 */
  proposals: readonly AiRubricProposalRow[]
  /** 設問が類型方式か・その類型（自分で採点の数字キーと採点ボタン、決めたことの札に使う） */
  scaleQuestion: ScaleQuestionState
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
  persistAdviceText,
  persistInstructionText,
  discardInstructionTexts,
  ownScoreOf,
  proposals,
  scaleQuestion,
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
    persistAdviceText,
    persistInstructionText,
    discardInstructionTexts,
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
  const { partialScore, scoreCursor, scoreCursorWithScaleLevel } =
    useQuestioningManualKeys({
      isActive: isManualActive,
      cropRegion,
      scaleQuestion,
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

  // 助言の欄がある問いを開いていれば、欄の文をその問いの答案に下見する（中央の一覧）
  const currentStepId = currentState?.step.id ?? null
  const currentAdvice = currentState?.step.advice ?? null
  const currentAdviceText =
    currentStepId !== null && currentAdvice
      ? flow.adviceTextOf(currentStepId)
      : null
  const currentRubricItemId = currentAdvice?.rubricItemId ?? null
  const advicePreview = useMemo((): AdviceTextPreviewRequest | null => {
    if (
      currentStepId === null ||
      currentAdviceText === null ||
      currentMembers === null
    ) {
      return null
    }
    return {
      stepId: currentStepId,
      adviceText: currentAdviceText,
      rubricItemId: currentRubricItemId,
      examStudentIds: currentMembers.map((member) => member.examStudentId),
    }
  }, [currentStepId, currentAdviceText, currentRubricItemId, currentMembers])

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
    /** 自分で採点している最中か（採点ボタンを押せるか） */
    isManualActive: cursorMember !== null,
    scoreCursor,
    /** 焦点のある答案に類型を付ける（類型方式の設問の類型のボタン・数字キー。下書き） */
    scoreCursorWithScaleLevel,
    scaleQuestion,
    summary,
    isMethodUnanswered,
    committedInstructionMembers,
    isGridNarrowed,
    setIsGridNarrowed,
    pinnedExamStudentIds,
    /** 助言の欄の下見（いまの問いの答案と欄の文）。助言の欄のある問いを開いていなければ null */
    advicePreview,
    /** 受験者 → 確定すると付く予定の点（一覧のマスに斜線で重ね、類型なら記号の札を添える） */
    draftScoreByExamStudentId: draftScores,
    /**
     * 自分で採点しているあいだ、一覧の選択の代わりに使うもの: 焦点の答案を選んでいる
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
