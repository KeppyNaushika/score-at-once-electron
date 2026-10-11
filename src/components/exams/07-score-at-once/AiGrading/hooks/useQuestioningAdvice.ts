/**
 * 問いかけの助言の欄（docs/vlm-grading-design.md §3-5）の文を持つ。AI 採点の案の問いだけにある。
 *
 * 欄の文は画面に持ち（問いを移っても残る）、書くのは `useQuestioningFlow` が答えと一緒に。
 * 書く値は、直していなければ null（確定で、当たる項目の助言か AI の文案のまま）、直していればその文
 * （"" は助言なし）。届いた行が追いつく前に同じ文を2度書かないよう、最後に書いた文を覚える。
 * 問いかけの組（scopeKey）が変わったら捨てる。
 */

import { useRef, useState } from "react"

import type {
  QuestioningStep,
  QuestioningStepState,
} from "../utils/questioningSteps"

interface UseQuestioningAdviceOptions {
  states: readonly QuestioningStepState[]
  scopeKey: string
}

export function useQuestioningAdvice({
  states,
  scopeKey,
}: UseQuestioningAdviceOptions) {
  const [adviceTexts, setAdviceTexts] = useState<Record<string, string>>({})
  const adviceTextRef = useRef<HTMLTextAreaElement | null>(null)
  /** 問い → 最後に書いた助言の文 */
  const sentAdviceRef = useRef(new Map<string, string>())
  const [adviceScope, setAdviceScope] = useState(scopeKey)
  if (adviceScope !== scopeKey) {
    setAdviceScope(scopeKey)
    setAdviceTexts({})
  }

  /** 助言の欄の文（直していなければ、いま効いている文）。助言の無い問いは "" */
  const adviceTextOf = (stepId: string): string => {
    const typed = adviceTexts[stepId]
    if (typed !== undefined) return typed
    const state = states.find((candidate) => candidate.step.id === stepId)
    return state?.step.advice?.text ?? ""
  }
  const setAdviceText = (stepId: string, text: string) =>
    setAdviceTexts((prev) => ({ ...prev, [stepId]: text }))

  /** 書く助言（直していなければ null）と、前に書いた文から変わったか */
  const adviceToSend = (step: QuestioningStep) => {
    if (!step.advice) return { adviceText: null, changed: false }
    const text = adviceTextOf(step.id).trim()
    const sentText = sentAdviceRef.current.get(step.id) ?? step.advice.text
    return {
      adviceText: text === step.advice.baseText.trim() ? null : text,
      changed: text !== sentText.trim(),
    }
  }

  /** 書いた助言を覚える */
  const markAdviceSent = (step: QuestioningStep, adviceText: string | null) => {
    if (step.advice) {
      sentAdviceRef.current.set(step.id, adviceText ?? step.advice.baseText)
    }
  }

  return {
    adviceTextRef,
    adviceTextOf,
    setAdviceText,
    adviceToSend,
    markAdviceSent,
  }
}
