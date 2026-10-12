/**
 * 問いかけの助言の欄（docs/vlm-grading-design.md §3-5）。AI採点の案の問いだけにある。
 *
 * **1打鍵ごとに即時に書く**（docs/coding-style.md「ジェスチャは終わったときに1回書く」の表:
 * テキストは1回ごとに即時。デバウンスも `onBlur` 確定も置かない）。書く先は案ごと・教員ごとの
 * 助言の行（その場で書き換える）で、答えの行（追記）ではない。答える前に直した文も読み込み直して残る。
 *
 * 入力中の文字は `useEditingText` が手元に持つ（取り直しが打鍵の合間に着地して文字が戻るのを防ぐ）。
 * 欄を抜けたら覚えを捨て、届いた行の文に戻す（書き込みではない）。
 *
 * 確定済みの問いの助言を直したら、同じ答えを1回だけ書き直して下書きに戻す（確定し直すと項目の助言に入る）。
 */

import { useRef } from "react"

import { useEditingText } from "@/hooks/useEditingText"

import type {
  QuestioningDecision,
  QuestioningStep,
  QuestioningStepState,
} from "../utils/questioningSteps"

/** 入力中の文字の欄の名前（useEditingText の鍵） */
const ADVICE_FIELD = "advice"

interface UseQuestioningAdviceOptions {
  states: readonly QuestioningStepState[]
  /** 助言の欄の文を書く */
  persistAdviceText: (step: QuestioningStep, adviceText: string) => void
  /** 確定済みの問いを、同じ答えで書き直して下書きに戻す */
  reopenDecision: (
    state: QuestioningStepState,
    decision: QuestioningDecision
  ) => void
}

export function useQuestioningAdvice({
  states,
  persistAdviceText,
  reopenDecision,
}: UseQuestioningAdviceOptions) {
  const { textOf, remember, forgetField } = useEditingText()
  const adviceTextRef = useRef<HTMLTextAreaElement | null>(null)
  /** 下書きに戻すために答えを書き直した問い（届いた行が下書きになるまで、2度書かない） */
  const reopenedStepIdsRef = useRef(new Set<string>())

  /** 助言の欄の文（入力中ならその文字、そうでなければ届いた行で効いている文）。助言の無い問いは "" */
  const adviceTextOf = (stepId: string): string => {
    const state = states.find((candidate) => candidate.step.id === stepId)
    return textOf(stepId, ADVICE_FIELD, state?.step.advice?.text ?? "")
  }

  /** 1打鍵ごと: 手元に覚えて、すぐ書く */
  const changeAdviceText = (stepId: string, text: string) => {
    const state = states.find((candidate) => candidate.step.id === stepId)
    if (!state?.step.advice) return
    remember(stepId, ADVICE_FIELD, text)
    persistAdviceText(state.step, text)
    const reopenedStepIds = reopenedStepIdsRef.current
    if (!state.isCommitted) {
      reopenedStepIds.delete(stepId)
    } else if (state.decision && !reopenedStepIds.has(stepId)) {
      reopenedStepIds.add(stepId)
      reopenDecision(state, state.decision)
    }
  }

  /** 欄を抜けた: 入力中の覚えを捨てる（書き込みではない） */
  const leaveAdviceText = (stepId: string) => forgetField(stepId, ADVICE_FIELD)

  return { adviceTextRef, adviceTextOf, changeAdviceText, leaveAdviceText }
}
