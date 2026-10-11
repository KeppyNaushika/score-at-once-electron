"use client"

import { Textarea } from "@/components/ui/textarea"

import { useOtherInstructionKeys } from "./hooks/useOtherInstructionKeys"
import type { QuestioningFlow } from "./hooks/useQuestioningFlow"
import type { QuestioningStepState } from "./utils/questioningSteps"

interface AiQuestioningOptionsProps {
  state: QuestioningStepState
  flow: QuestioningFlow
}

/**
 * 問いの選択肢の並び（問いの選択肢 →「1件ずつ自分で採点する」→「その他：再採点を指示する」）。
 * ↑↓ かクリックで焦点を移し（選ぶだけで決めない）、Enter かカードの「次へ」で決める
 */
export function AiQuestioningOptions({
  state,
  flow,
}: AiQuestioningOptionsProps) {
  const { step } = state
  const handleOtherKeyDown = useOtherInstructionKeys({
    onLeaveUpward: flow.leaveOtherTextUpward,
  })
  const pick = (entryIndex: number) => flow.setFocusedIndex(entryIndex)

  return (
    <ul role="listbox" aria-label="選択肢" className="space-y-1">
      {flow.entries.map((entry, entryIndex) => {
        const isFocused = entryIndex === flow.focusedIndex
        const rowClass = `grid cursor-pointer grid-cols-[0.75rem_1fr_auto] items-baseline gap-1.5 rounded border px-1.5 py-1 text-[11px] ${
          isFocused ? "border-primary bg-primary/5" : "border-transparent"
        }`
        const cursor = (
          <span
            aria-hidden
            className={`font-bold text-primary ${isFocused ? "" : "invisible"}`}
          >
            ❯
          </span>
        )
        if (entry.kind === "option") {
          const option = step.options[entry.optionIndex]
          return (
            <li
              key={option.key}
              role="option"
              aria-selected={isFocused}
              className={rowClass}
              onClick={() => pick(entryIndex)}
            >
              {cursor}
              <span>{option.label}</span>
              {option.recommended ? (
                <span className="rounded border border-primary px-1 text-[10px] text-primary">
                  推奨
                </span>
              ) : (
                <span />
              )}
              {option.description && (
                <span className="col-start-2 col-end-4 text-[10px] text-muted-foreground">
                  {option.description}
                </span>
              )}
            </li>
          )
        }
        if (entry.kind === "manual") {
          return (
            <li
              key="manual"
              role="option"
              aria-selected={isFocused}
              className={rowClass}
              onClick={() => pick(entryIndex)}
            >
              {cursor}
              <span>1件ずつ自分で採点する</span>
              <span />
              {flow.isManualActive && (
                <span className="col-start-2 col-end-4 text-[10px] text-amber-700">
                  中央の一覧で
                  ←→（またはクリック）で答案を移り、採点キー（数字は部分点）で採点。Enter
                  か「次へ」で終えて次へ
                </span>
              )}
            </li>
          )
        }
        return (
          <li
            key="other"
            role="option"
            aria-selected={isFocused}
            className={rowClass}
            onClick={(event) => {
              if (event.target instanceof HTMLTextAreaElement) return
              pick(entryIndex)
            }}
          >
            {cursor}
            <span>その他：再採点を指示する</span>
            <span />
            <div className="col-start-2 col-end-4">
              <Textarea
                ref={flow.otherTextRef}
                aria-label="再採点への指示"
                value={flow.otherTextOf(step.id)}
                onChange={(event) =>
                  flow.setOtherText(step.id, event.target.value)
                }
                onFocus={() => flow.setFocusedIndex(entryIndex)}
                onKeyDown={handleOtherKeyDown}
                placeholder="例：誤字は1字までなら部分点1点として採点し直して"
                className={`min-h-14 text-xs ${isFocused ? "" : "hidden"}`}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
