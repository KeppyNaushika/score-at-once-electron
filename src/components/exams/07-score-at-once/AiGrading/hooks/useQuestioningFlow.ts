/**
 * 問いかけの流れ（docs/vlm-grading-design.md §3-5・§11-4）: 1問ずつのカードで答え、決めたことを
 * 上に積み、最後に見直して確定する。AI 採点と AI 採点チェックで同じもの。
 *
 * - ↑↓ で選び、Enter で決めて次の答えていない問いへ。選択肢のクリックは焦点を移すだけ（決めない）
 * - 「次へ」（Ctrl/⌘+Enter）は Enter と同じく決めて次へ、「戻る」（Ctrl/⌘+Shift+Enter）で前の問いへ。
 *   このふたつのキーは、問いかけのタブを開いている間いつでも効く（選択の場面を Esc で抜けていても、
 *   「その他」の欄の中でも、1件ずつ採点の最中でも。ダイアログ・部分点の入力欄を開いている間は効かない）
 * - 選択肢の並びは、問いの選択肢 →「1件ずつ自分で採点する」→「その他：再採点を指示する」
 * - 「1件ずつ自分で採点する」の上の Enter で、問いの答案を ←→ で移りながら（中央の一覧のマスを
 *   クリックしても移れる）採点キーで点を付ける。
 *   もう一度 Enter で決めて次へ。↑↓ で別の選択肢へ移ると抜ける（付けた点はその問いの間は残る）
 * - 「その他」へ移ると欄に入る。欄の中は `useOtherInstructionKeys`
 *
 * 決めたことは下書きとして AI の層へすぐ書く（読み込み直しても消えない）。教員の採点はここでは書かない。
 * 持つのは利用者の選択（開いている問い・焦点・1件ずつ採点の途中・欄の文）だけで、問いと答えは届いた行から導く。
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { useChoiceScene } from "@/components/exams/07-score-at-once/hooks/useChoiceScene"
import { useSceneCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"

import {
  nextUndecidedStepId,
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

/** 開いているもの。null は自動（答えていない最初の問い。無ければ見直し） */
type OpenedEntry = { kind: "step"; stepId: string } | { kind: "review" }

/** 1件ずつ採点の途中 */
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
  /** キーを効かせるか（問いかけのタブを開いているあいだだけ） */
  isEnabled: boolean
  /**
   * 問いかけの組（AI 採点か AI 採点チェックか）。変わったら、開いている問い・1件ずつ採点の途中・
   * 欄の文を捨てて、答えていない最初の問いから始める
   */
  scopeKey: string
}

export function useQuestioningFlow({
  states,
  persistDecision,
  isEnabled,
  scopeKey,
}: UseQuestioningFlowOptions) {
  const [opened, setOpened] = useState<OpenedEntry | null>(null)
  const [manual, setManual] = useState<ManualDraft | null>(null)
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({})
  const otherTextRef = useRef<HTMLTextAreaElement | null>(null)
  const [openedScope, setOpenedScope] = useState(scopeKey)
  if (openedScope !== scopeKey) {
    setOpenedScope(scopeKey)
    setOpened(null)
    setManual(null)
    setOtherTexts({})
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
    setOpened(entry)
  }
  const openStep = (stepId: string) => open({ kind: "step", stepId })
  const openReview = () => open({ kind: "review" })

  const otherTextOf = (stepId: string): string => {
    const typed = otherTexts[stepId]
    if (typed !== undefined) return typed
    const state = states.find((candidate) => candidate.step.id === stepId)
    return state?.decision?.kind === "instruction" ? state.decision.text : ""
  }
  const setOtherText = (stepId: string, text: string) =>
    setOtherTexts((prev) => ({ ...prev, [stepId]: text }))

  /** 決めて、次の答えていない問いへ（無ければ見直しへ） */
  const decideWith = (
    state: QuestioningStepState,
    decision: QuestioningDecision
  ) => {
    if (!isSameDecision(state.decision, decision)) {
      void persistDecision(state.step, decision).catch(() => {
        // 失敗の通知は MutationCache のトーストが出す
      })
    }
    setManual(null)
    const nextId = nextUndecidedStepId(states, state.step.id)
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

  /** 1件ずつ採点している最中か（焦点が「1件ずつ」にあり、始めている） */
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
  /** 1件ずつ採点の焦点を、その答案（受験者）へ（中央の一覧のマスを選んだとき）。問いの外の答案なら動かない */
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
  /** 「次へ」で 1件ずつ採点を始める（焦点が「1件ずつ」にあり、まだ始めていない）か */
  const startsManualOnNext = focusedEntry?.kind === "manual" && !isManualActive
  const canGoToPrevious = previousStepId(states, currentStepId) !== null

  /** 「その他」の欄の1行目で ↑：欄を抜けて上の選択肢へ */
  const leaveOtherTextUpward = () => {
    leaveOtherText()
    setFocusedIndex(Math.max(0, focusedIndex - 1))
  }

  /** 見直しの「確定する」のあと: 「その他」を選んでいない問いの欄の文を捨てる */
  const discardUnusedOtherTexts = () =>
    setOtherTexts((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([stepId]) => {
          const state = states.find((candidate) => candidate.step.id === stepId)
          return state?.decision?.kind === "instruction"
        })
      )
    )

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
    setOtherText,
    leaveOtherTextUpward,
    discardUnusedOtherTexts,
  }
}

export type QuestioningFlow = ReturnType<typeof useQuestioningFlow>
