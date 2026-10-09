"use client"

import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ScoringMethod } from "@/types/rubric.types"

import {
  SCORING_METHOD_DESCRIPTIONS,
  SCORING_METHOD_LABELS,
} from "../Rubric/utils/rubricEffectLabel"
import { QUESTIONING_SCORING_METHODS } from "./hooks/useAiQuestioningPanel"

interface AiScoringMethodQuestionProps {
  recommendedMethod: Exclude<ScoringMethod, "points">
  focusedIndex: number
  numberOf: (entryIndex: number) => number | null
  isChoiceSceneOpen: boolean
  onFocus: (entryIndex: number) => void
  onDecide: (method: Exclude<ScoringMethod, "points">) => void
  /** 直接採点のまま、AI の判定を採用する（採点反映のタブへ） */
  onKeepDirectScoring: () => void
}

/**
 * 直接採点の設問で、最初の問いかけの前に採点方式を決める問いかけ（docs/vlm-grading-design.md §3-5）。
 * 問いかけで選ぶと項目ができ、項目から点を計算するので、減点方式か加点方式でないと点が付かない。
 * AI は呼ばない
 */
export function AiScoringMethodQuestion({
  recommendedMethod,
  focusedIndex,
  numberOf,
  isChoiceSceneOpen,
  onFocus,
  onDecide,
  onKeepDirectScoring,
}: AiScoringMethodQuestionProps) {
  return (
    <section
      aria-label="問いかけ: 採点方式"
      className="rounded border border-amber-300 bg-amber-50/40 p-2 text-xs"
    >
      <h4 className="text-sm font-medium text-gray-900">
        減点方式にしますか、加点方式にしますか
      </h4>
      <p className="mt-0.5 text-gray-700">
        この設問は直接採点です。問いかけに答えると項目ができ、項目から点を計算するので、先に採点方式を決めます。
      </p>
      <ol className="mt-2 space-y-1">
        {QUESTIONING_SCORING_METHODS.map((method, methodIndex) => {
          const choiceNumber = isChoiceSceneOpen ? numberOf(methodIndex) : null
          const isFocused = methodIndex === focusedIndex
          return (
            <li key={method}>
              <button
                type="button"
                aria-pressed={isFocused}
                className={`flex w-full items-start gap-1.5 rounded border px-2 py-1.5 text-left ${
                  isFocused
                    ? "border-amber-400 bg-amber-100"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
                onClick={() => onFocus(methodIndex)}
                onDoubleClick={() => onDecide(method)}
              >
                <span
                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-semibold ${
                    choiceNumber !== null
                      ? "bg-amber-200 text-amber-900"
                      : "text-transparent"
                  }`}
                >
                  {choiceNumber ?? "·"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 font-medium text-gray-900">
                    {SCORING_METHOD_LABELS[method]}
                    {method === recommendedMethod && (
                      <span className="rounded bg-amber-200 px-1 text-[10px] text-amber-900">
                        推奨
                      </span>
                    )}
                  </span>
                  <span className="block text-[11px] text-gray-600">
                    {SCORING_METHOD_DESCRIPTIONS[method]}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <Button
        size="sm"
        className="mt-2 w-full"
        onClick={() => onDecide(QUESTIONING_SCORING_METHODS[focusedIndex])}
      >
        <Check className="h-4 w-4" />
        この方式にする
      </Button>
      <button
        type="button"
        className="mt-1 w-full text-center text-[11px] text-gray-600 underline"
        onClick={onKeepDirectScoring}
      >
        直接採点のまま、AI の判定を採用する（採点反映のタブ）
      </button>
    </section>
  )
}
