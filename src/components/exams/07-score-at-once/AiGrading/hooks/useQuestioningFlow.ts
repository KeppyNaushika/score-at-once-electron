/**
 * 問いかけの流れ（docs/vlm-grading-design.md §3-5・§11-4）: 1問ずつのカードで答え、決めたことを
 * 上に積み、最後に見直して確定する。AI 採点と AI チェックで同じもの。
 *
 * - ↑↓ で選び、Enter で決めて並びの次の問いへ（答えてある問いも飛ばさない。最後の問いからは見直しへ）。
 *   選択肢のクリックは焦点を移すだけ（決めない）
 * - 「次へ」（Ctrl/⌘+Enter）は Enter と同じく決めて次へ、「戻る」（Ctrl/⌘+Shift+Enter）で前の問いへ。
 *   このふたつのキーは、問いかけのタブを開いている間いつでも効く（選択の場面を Esc で抜けていても、
 *   「その他」の欄の中でも、自分で採点の最中でも。ダイアログ・部分点の入力欄を開いている間は効かない）
 * - 選択肢の並びは、問いの選択肢 →「自分で採点する」→「その他：再採点を指示する」
 * - 「自分で採点する」の上の Enter で、問いの答案を ←→ で移りながら（中央の一覧のマスを
 *   クリックしても移れる）採点キーで点を付ける。
 *   もう一度 Enter で決めて次へ。↑↓ で別の選択肢へ移ると抜ける（付けた点はその問いの間は残る）
 * - 「その他」へ移ると欄に入る。欄の中は `useOtherInstructionKeys`。欄の文は1打鍵ごとに、案ごと・教員ごとの行へ書く
 *   （デバウンスも `onBlur` 確定も置かない。入力中の文字は `useEditingText` が手元に持ち、欄を抜けたら覚えを捨てる）
 * - 案の問いには助言の欄がある（クリックで入る。Esc で抜ける）。直した文は1打鍵ごとに書く（`useQuestioningAdvice`）
 *
 * 決めたことは下書きとして AI の層へすぐ書く（読み込み直しても消えない）。教員の採点はここでは書かない。
 * 持つのは利用者の選択（開いている問い・焦点・自分で採点の途中・入力中の欄の文字）だけで、問いと答え・欄の文は届いた行から導く。
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { useChoiceScene } from "@/components/exams/07-score-at-once/hooks/useChoiceScene"
import { useSceneCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"
import { useEditingText } from "@/hooks/useEditingText"

import {
  nextStepId,
  previousStepId,
  resolveOpenedStepId,
} from "../utils/questioningReview"
import {
  isSameDecision,
  type QuestioningDecision,
  type QuestioningScore,
  type QuestioningStep,
  type QuestioningStepState,
} from "../utils/questioningSteps"
import { useQuestioningAdvice } from "./useQuestioningAdvice"

/** 入力中の文字の欄の名前（useEditingText の鍵） */
const INSTRUCTION_FIELD = "instruction"

/** 開いているもの。null は自動（答えていない最初の問い。無ければ見直し） */
type OpenedEntry = { kind: "step"; stepId: string } | { kind: "review" }

/** 自分で採点の途中 */
interface ManualDraft {
  stepId: string
  cursor: number
  scores: ReadonlyMap<string, QuestioningScore>
}

/** 選択肢の並びの1つ */
export type QuestioningEntry =
  | { kind: "option"; optionIndex: number }
  | { kind: "manual" }
  | { kind: "other" }

/** 問いの選択肢の並び */
export function entriesOf(step: QuestioningStep): QuestioningEntry[] {
  return [
    ...step.options.map((_option, optionIndex) => ({
      kind: "option" as const,
      optionIndex,
    })),
    ...(step.allowsManual ? [{ kind: "manual" as const }] : []),
    ...(step.allowsInstruction ? [{ kind: "other" as const }] : []),
  ]
}

/** 問いを開いたときに焦点を置く位置: いまの答え、無ければ推奨 */
function initialFocusOf(state: QuestioningStepState): number {
  const entries = entriesOf(state.step)
  const { decision, step } = state
  const decidedIndex = entries.findIndex((entry) => {
    if (!decision) return false
    if (entry.kind === "option") {
      return (
        decision.kind === "option" &&
        step.options[entry.optionIndex]?.key === decision.optionKey
      )
    }
    return entry.kind === "manual"
      ? decision.kind === "manual"
      : decision.kind === "instruction"
  })
  if (decidedIndex >= 0) return decidedIndex
  return Math.max(
    0,
    step.options.findIndex((option) => option.recommended)
  )
}

interface UseQuestioningFlowOptions {
  states: readonly QuestioningStepState[]
  /** 決めたことを下書きとして書く */
  persistDecision: (
    step: QuestioningStep,
    decision: QuestioningDecision
  ) => Promise<unknown>
  /** 助言の欄の文を書く（1打鍵ごと） */
  persistAdviceText: (step: QuestioningStep, adviceText: string) => void
  /** 「その他」の欄の文を書く（1打鍵ごと） */
  persistInstructionText: (
    step: QuestioningStep,
    instructionText: string
  ) => void
  /** 「その他」の欄の文を捨てる（確定のとき、「その他」を選んでいない問い） */
  discardInstructionTexts: (steps: readonly QuestioningStep[]) => void
  /** キーを効かせるか（問いかけのタブを開いているあいだだけ） */
  isEnabled: boolean
  /**
   * 問いかけの組（AI 採点か AI チェックか）。変わったら、開いている問い・自分で採点の途中を
   * 捨てて、答えていない最初の問いから始める
   */
  scopeKey: string
}

export function useQuestioningFlow({
  states,
  persistDecision,
  persistAdviceText,
  persistInstructionText,
  discardInstructionTexts,
  isEnabled,
  scopeKey,
}: UseQuestioningFlowOptions) {
  const [opened, setOpened] = useState<OpenedEntry | null>(null)
  const [manual, setManual] = useState<ManualDraft | null>(null)
  const otherText = useEditingText()
  const otherTextRef = useRef<HTMLTextAreaElement | null>(null)
  const [openedScope, setOpenedScope] = useState(scopeKey)
  if (openedScope !== scopeKey) {
    setOpenedScope(scopeKey)
    setOpened(null)
    setManual(null)
  }

  const currentStepId =
    opened?.kind === "review"
      ? null
      : resolveOpenedStepId(
          states,
          opened?.kind === "step" ? opened.stepId : null
        )
  const currentState =
    states.find((state) => state.step.id === currentStepId) ?? null
  const entries = currentState ? entriesOf(currentState.step) : []

  const leaveOtherText = () => otherTextRef.current?.blur()

  const open = (entry: OpenedEntry) => {
    leaveOtherText()
    adviceTextRef.current?.blur()
    setOpened(entry)
  }
  const openStep = (stepId: string) => open({ kind: "step", stepId })
  const openReview = () => open({ kind: "review" })

  /**
   * 「その他」の欄の文。入力中ならその文字、そうでなければ書いてある行の文、行が無ければ
   * 決めた再採点への指示（無ければ ""）
   */
  const otherTextOf = (stepId: string): string => {
    const state = states.find((candidate) => candidate.step.id === stepId)
    const decidedText =
      state?.decision?.kind === "instruction" ? state.decision.text : ""
    return otherText.textOf(
      stepId,
      INSTRUCTION_FIELD,
      state?.step.instructionDraft ?? decidedText
    )
  }
  /** 1打鍵ごと: 手元に覚えて、すぐ書く */
  const setOtherText = (stepId: string, text: string) => {
    const state = states.find((candidate) => candidate.step.id === stepId)
    if (!state?.step.allowsInstruction) return
    otherText.remember(stepId, INSTRUCTION_FIELD, text)
    persistInstructionText(state.step, text)
  }
  /** 欄を抜けた: 入力中の覚えを捨てる（書き込みではない） */
  const forgetOtherText = (stepId: string) =>
    otherText.forgetField(stepId, INSTRUCTION_FIELD)

  const persist = (
    state: QuestioningStepState,
    decision: QuestioningDecision
  ) => {
    void persistDecision(state.step, decision).catch(() => {
      // 失敗の通知は MutationCache のトーストが出す
    })
  }
  const advice = useQuestioningAdvice({
    states,
    persistAdviceText,
    reopenDecision: persist,
  })
  const { adviceTextRef } = advice

  /** 決めて、並びの次の問いへ（最後の問いなら見直しへ） */
  const decideWith = (
    state: QuestioningStepState,
    decision: QuestioningDecision
  ) => {
    if (!isSameDecision(state.decision, decision)) persist(state, decision)
    setManual(null)
    const nextId = nextStepId(states, state.step.id)
    if (nextId) openStep(nextId)
    else openReview()
  }

  const manualOf = (state: QuestioningStepState): ManualDraft => {
    if (manual?.stepId === state.step.id) return manual
    return {
      stepId: state.step.id,
      cursor: 0,
      scores:
        state.decision?.kind === "manual" ? state.decision.scores : new Map(),
    }
  }

  const confirm = (focusedIndex: number) => {
    if (!currentState) return
    const entry = entries[focusedIndex]
    if (!entry) return
    switch (entry.kind) {
      case "option": {
        const option = currentState.step.options[entry.optionIndex]
        if (option) {
          decideWith(currentState, { kind: "option", optionKey: option.key })
        }
        return
      }
      case "manual": {
        if (manual?.stepId !== currentState.step.id) {
          setManual(manualOf(currentState))
          return
        }
        decideWith(currentState, { kind: "manual", scores: manual.scores })
        return
      }
      case "other": {
        const text = otherTextOf(currentState.step.id).trim()
        if (text === "") {
          otherTextRef.current?.focus()
          return
        }
        leaveOtherText()
        decideWith(currentState, { kind: "instruction", text })
      }
    }
  }

  const goToPrevious = () => {
    const previousId = previousStepId(states, currentStepId)
    if (previousId) {
      setManual(null)
      openStep(previousId)
    }
  }

  const choiceScene = useChoiceScene({
    entryCount: entries.length,
    usesNumberKeys: false,
    onSelect: () => undefined,
    onConfirm: confirm,
    onExit: () => {
      if (manual) setManual(null)
      else choiceScene.close()
    },
    isEnabled,
  })
  const { open: openScene, setFocusedIndex, focusedIndex } = choiceScene

  /** 「次へ」: 焦点のある選択肢で、Enter と同じく決めて次へ */
  const goToNext = () => confirm(focusedIndex)

  // 次へ・戻るのキーは選択の場面の外でも効かせる（場面に入っていなくても、欄の中でも）
  const moveCondition = isEnabled ? undefined : "false"
  useSceneCommand("choice.nextQuestion", goToNext, {
    scene: "questioning",
    condition: moveCondition,
    metadata: { title: "次へ（問いかけ）", category: "選択の場面" },
  })
  useSceneCommand("choice.prevQuestion", goToPrevious, {
    scene: "questioning",
    condition: moveCondition,
    metadata: { title: "戻る（問いかけ）", category: "選択の場面" },
  })

  // 問いかけのタブを開いているあいだは選択の場面に入れておく（Esc で抜け、Space で戻る）
  useEffect(() => {
    if (isEnabled) openScene()
  }, [isEnabled, scopeKey, openScene])

  // 問いが変わったら、焦点をいまの答え（無ければ推奨）に置く
  const [focusedFor, setFocusedFor] = useState<string | null>(null)
  if (currentStepId !== focusedFor) {
    setFocusedFor(currentStepId)
    if (currentState) setFocusedIndex(initialFocusOf(currentState))
  }

  const focusedEntry = entries[focusedIndex] ?? null
  // 「その他」へ移ったら欄に入る
  const isOtherFocused = focusedEntry?.kind === "other"
  useEffect(() => {
    if (isOtherFocused) otherTextRef.current?.focus()
  }, [isOtherFocused, currentStepId])

  /** 自分で採点している最中か（焦点が「自分で採点する」にあり、始めている） */
  const isManualActive =
    currentState !== null &&
    manual?.stepId === currentState.step.id &&
    focusedEntry?.kind === "manual"
  const manualDraft = currentState ? manualOf(currentState) : null

  const moveManualCursor = useCallback(
    (step: -1 | 1) =>
      setManual((prev) =>
        prev && currentState
          ? {
              ...prev,
              cursor: Math.max(
                0,
                Math.min(
                  prev.cursor + step,
                  currentState.step.members.length - 1
                )
              ),
            }
          : prev
      ),
    [currentState]
  )
  /** 自分で採点の焦点を、その答案（受験者）へ（中央の一覧のマスを選んだとき）。問いの外の答案なら動かない */
  const placeManualCursor = (examStudentId: string) => {
    if (!currentState || !manual) return
    const memberIndex = currentState.step.members.findIndex(
      (member) => member.examStudentId === examStudentId
    )
    if (memberIndex >= 0) setManual({ ...manual, cursor: memberIndex })
  }
  const scoreManualCursor = (score: QuestioningScore) => {
    if (!currentState || !manual) return
    const member = currentState.step.members[manual.cursor]
    if (!member) return
    const scores = new Map(manual.scores)
    scores.set(member.examStudentId, score)
    setManual({
      ...manual,
      scores,
      cursor: Math.min(manual.cursor + 1, currentState.step.members.length - 1),
    })
  }

  /** 「次へ」を押せない理由（「その他」を選んで欄が空のとき）。押せるなら null */
  const nextBlockedReason =
    currentState &&
    isOtherFocused &&
    otherTextOf(currentState.step.id).trim() === ""
      ? "「その他」を選んでいるときは、指示を書くと次へ進めます。"
      : null
  /** 「次へ」で自分で採点を始める（焦点が「自分で採点する」にあり、まだ始めていない）か */
  const startsManualOnNext = focusedEntry?.kind === "manual" && !isManualActive
  const canGoToPrevious = previousStepId(states, currentStepId) !== null

  /** 「その他」の欄の1行目で ↑：欄を抜けて上の選択肢へ */
  const leaveOtherTextUpward = () => {
    leaveOtherText()
    setFocusedIndex(Math.max(0, focusedIndex - 1))
  }

  /** 見直しの「確定する」のとき: 「その他」を選んでいない問いの欄の文を捨てる（書いてある行も消す） */
  const discardUnusedOtherTexts = () => {
    const unusedStates = states.filter(
      (state) =>
        state.step.allowsInstruction && state.decision?.kind !== "instruction"
    )
    unusedStates.forEach((state) => forgetOtherText(state.step.id))
    const stepsWithDraft = unusedStates
      .map((state) => state.step)
      .filter((step) => step.instructionDraft !== null)
    if (stepsWithDraft.length > 0) discardInstructionTexts(stepsWithDraft)
  }

  return {
    currentState,
    isReviewOpen: currentState === null,
    entries,
    focusedIndex,
    setFocusedIndex,
    confirm,
    goToNext,
    nextBlockedReason,
    startsManualOnNext,
    goToPrevious,
    canGoToPrevious,
    openStep,
    openReview,
    isManualActive,
    manualDraft,
    moveManualCursor,
    placeManualCursor,
    scoreManualCursor,
    otherTextRef,
    otherTextOf,
    adviceTextRef,
    adviceTextOf: advice.adviceTextOf,
    changeAdviceText: advice.changeAdviceText,
    leaveAdviceText: advice.leaveAdviceText,
    setOtherText,
    forgetOtherText,
    leaveOtherTextUpward,
    discardUnusedOtherTexts,
  }
}

export type QuestioningFlow = ReturnType<typeof useQuestioningFlow>
