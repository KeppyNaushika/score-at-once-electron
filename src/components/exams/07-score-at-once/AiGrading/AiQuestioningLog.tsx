"use client"

import {
  describeDecision,
  type QuestioningStepState,
} from "./utils/questioningSteps"

interface AiQuestioningLogProps {
  states: readonly QuestioningStepState[]
  /** いま開いている問い。見直しなら null */
  currentStepId: string | null
  onOpen: (stepId: string) => void
}

/**
 * 問いの一覧。すべての問いを並び順のまま「見出し → 決めたこと（未回答）」の1行で出す。
 * 行の全体がボタンで、押すとその問いを開く（焦点を当てて Enter・Space でも開く）。
 * いま開いている問いの行は、選択肢の焦点と同じ見た目で示す
 */
export function AiQuestioningLog({
  states,
  currentStepId,
  onOpen,
}: AiQuestioningLogProps) {
  if (states.length === 0) return null
  return (
    <ul aria-label="問いの一覧" className="space-y-1">
      {states.map((state) => {
        const isCurrent = state.step.id === currentStepId
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
              className={`grid w-full cursor-pointer grid-cols-1 rounded border px-2 py-1 text-left text-[11px] hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none ${
                isCurrent ? "border-primary bg-primary/5" : "border-gray-200"
              }`}
            >
              <span className="min-w-0 truncate text-gray-700">
                {state.step.title}
              </span>
              {state.decision ? (
                <span className="font-medium text-gray-800">
                  → {describeDecision(state.step, state.decision)}
                  {state.isCommitted && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      （確定済み）
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">→ 未回答</span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
