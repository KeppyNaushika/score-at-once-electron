"use client"

import { AiDecisionBadge } from "./AiDecisionBadge"
import {
  decisionBadgeOf,
  memberCountLabelOf,
  type QuestioningScaleLevel,
  type QuestioningStepState,
} from "./utils/questioningSteps"

interface AiQuestioningLogProps {
  states: readonly QuestioningStepState[]
  /** いま開いている問い。見直しなら null */
  currentStepId: string | null
  onOpen: (stepId: string) => void
  /** 問いの助言の欄の文（助言の無い問いは ""） */
  adviceTextOf: (stepId: string) => string
  /** 設問の類型表の類型（類型で決めた札を記号と類型の色で出す。類型方式でなければ空） */
  scaleLevels: readonly QuestioningScaleLevel[]
}

/**
 * 問いの一覧。すべての問いを並び順のまま出す。左に見出しと件数・2行目に助言（あれば。はみ出すと…）、
 * 右に決めたことの札（未回答）。
 * 行の全体がボタンで、押すとその問いを開く（焦点を当てて Enter・Space でも開く）。
 * いま開いている問いの行は、選択肢の焦点と同じ見た目で示す
 */
export function AiQuestioningLog({
  states,
  currentStepId,
  onOpen,
  adviceTextOf,
  scaleLevels,
}: AiQuestioningLogProps) {
  if (states.length === 0) return null
  return (
    <ul aria-label="問いの一覧" className="space-y-1">
      {states.map((state) => {
        const isCurrent = state.step.id === currentStepId
        const countLabel = memberCountLabelOf(state.step)
        const adviceText = state.step.advice
          ? adviceTextOf(state.step.id).trim()
          : ""
        return (
          <li key={state.step.id}>
            <button
              type="button"
              // 焦点があるときの素の Enter・Space は採点画面のキーに取らせず、行を押す（ShortcutProvider）
              data-native-activation=""
              aria-current={isCurrent ? "step" : undefined}
              onClick={(event) => {
                onOpen(state.step.id)
                // 開いたあとの Enter・↑↓ は選択肢へ（行に焦点を残すと Enter が行を押し直す）
                event.currentTarget.blur()
              }}
              className={`grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border px-2 py-1 text-left text-[11px] hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none ${
                isCurrent ? "border-primary bg-primary/5" : "border-gray-200"
              }`}
            >
              <span className="min-w-0">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-gray-700">
                    {state.step.title}
                  </span>
                  {countLabel && (
                    <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                      {countLabel}
                    </span>
                  )}
                </span>
                {adviceText && (
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {adviceText}
                  </span>
                )}
              </span>
              <AiDecisionBadge
                badge={
                  state.decision
                    ? decisionBadgeOf(state.step, state.decision, scaleLevels)
                    : null
                }
              />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
