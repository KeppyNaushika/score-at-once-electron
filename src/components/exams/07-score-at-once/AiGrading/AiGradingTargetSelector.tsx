"use client"

import { type KeyboardEvent, useRef } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

import {
  GRADING_TARGET_MODE_DESCRIPTIONS,
  GRADING_TARGET_MODE_LABELS,
  GRADING_TARGET_MODES,
  type GradingTargetMode,
  type GradingTargetSelection,
} from "./utils/selectGradingTargets"

/** カードの並びの列数（2列 × 3行） */
const CARD_COLUMN_COUNT = 2

/** 矢印キーごとに、カードの並びの中で何枚先へ移るか */
const ARROW_KEY_STEPS = new Map<string, number>([
  ["ArrowRight", 1],
  ["ArrowLeft", -1],
  ["ArrowDown", CARD_COLUMN_COUNT],
  ["ArrowUp", -CARD_COLUMN_COUNT],
])

interface AiGradingTargetSelectorProps {
  /** 選んだ選び方。開いた時点では選んでいない（null）。毎回、利用者に選ばせる */
  targetMode: GradingTargetMode | null
  onTargetModeChange: (targetMode: GradingTargetMode) => void
  /** 選び方ごとの選択結果（件数を並べる） */
  selectionByMode: Record<GradingTargetMode, GradingTargetSelection>
  includeBorderline: boolean
  onIncludeBorderlineChange: (includeBorderline: boolean) => void
  includeBlank: boolean
  onIncludeBlankChange: (includeBlank: boolean) => void
}

/** カードの下に添える、除く答案（と、含めた白紙）の1行 */
function exclusionText(selection: GradingTargetSelection): string {
  const exclusions = [
    selection.excludedBlankCount > 0
      ? `白紙 ${selection.excludedBlankCount}件`
      : null,
    selection.excludedBorderlineCount > 0
      ? `境界帯 ${selection.excludedBorderlineCount}件`
      : null,
  ].filter((exclusion) => exclusion !== null)
  const includedBlankCount = selection.blankCount - selection.excludedBlankCount
  const inclusionText =
    includedBlankCount > 0 ? `白紙 ${includedBlankCount}件を含む` : null
  const exclusionPart =
    exclusions.length === 0 ? null : `${exclusions.join("・")}を除く`
  if (inclusionText === null && exclusionPart === null) return "除く答案なし"
  return [inclusionText, exclusionPart]
    .filter((part) => part !== null)
    .join("・")
}

/** 白紙も送るかの選択の下に添える、選んだ選び方での白紙の件数 */
function blankSummaryText(
  selection: GradingTargetSelection,
  includeBlank: boolean
): string {
  if (selection.blankCount === 0)
    return "この選び方に白紙と判定した答案はありません"
  return includeBlank
    ? `白紙と判定した ${selection.blankCount}件も送ります（その分の費用がかかります）`
    : `白紙として外した ${selection.blankCount}件。判定が外れて書いてある答案があれば、上で含められます`
}

/**
 * 採点する答案の選び方（設計 §3-2）。6つの選び方を 2列 × 3行のカードで並べ、
 * それぞれに送る件数と、除く答案の数を出す。
 *
 * - 前もって選んだ状態にはしない（送る答案は毎回、件数を見て教員が選ぶ）
 * - 送る答案が0件の選び方は、見せるが選ばせない
 * - キーボード: Tab でカードの並びへ入り、矢印キーでカードを移り（選ばない）、
 *   Enter / Space で選ぶ
 */
export function AiGradingTargetSelector({
  targetMode,
  onTargetModeChange,
  selectionByMode,
  includeBorderline,
  onIncludeBorderlineChange,
  includeBlank,
  onIncludeBlankChange,
}: AiGradingTargetSelectorProps) {
  const cardRefs = useRef<Map<GradingTargetMode, HTMLButtonElement>>(new Map())
  const selectableModes = GRADING_TARGET_MODES.filter(
    (mode) => selectionByMode[mode].examStudentIds.length > 0
  )
  // Tab で入る先は、選んでいるカード（無ければ最初の選べるカード）だけにする
  const tabStopMode =
    targetMode !== null && selectableModes.includes(targetMode)
      ? targetMode
      : (selectableModes[0] ?? null)

  /** 矢印キーで、その向きにある次の選べるカードへフォーカスを移す */
  const moveFocus = (
    event: KeyboardEvent<HTMLButtonElement>,
    fromMode: GradingTargetMode
  ) => {
    const step = ARROW_KEY_STEPS.get(event.key)
    if (step === undefined) return
    event.preventDefault()
    const modeCount = GRADING_TARGET_MODES.length
    const fromIndex = GRADING_TARGET_MODES.indexOf(fromMode)
    // 選べないカードは飛ばす。端まで行ったら反対の端から回る
    const nextMode = Array.from(
      { length: modeCount - 1 },
      (_unused, offset) =>
        GRADING_TARGET_MODES[
          (((fromIndex + step * (offset + 1)) % modeCount) + modeCount) %
            modeCount
        ]
    ).find((mode) => selectableModes.includes(mode))
    if (nextMode) cardRefs.current.get(nextMode)?.focus()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p id="ai-grading-target-label" className="text-sm font-medium">
          採点する答案
        </p>
        {targetMode === null && (
          <p
            className="text-xs text-amber-700"
            data-testid="ai-grading-target-placeholder"
          >
            採点する答案を選んでください
          </p>
        )}
      </div>

      <div
        role="radiogroup"
        aria-labelledby="ai-grading-target-label"
        className="grid grid-cols-2 gap-2"
      >
        {GRADING_TARGET_MODES.map((mode) => {
          const selection = selectionByMode[mode]
          const isChecked = mode === targetMode
          const isSelectable = selectableModes.includes(mode)
          return (
            <button
              key={mode}
              ref={(card) => {
                if (card) cardRefs.current.set(mode, card)
                else cardRefs.current.delete(mode)
              }}
              type="button"
              role="radio"
              aria-checked={isChecked}
              aria-label={`${GRADING_TARGET_MODE_LABELS[mode]} ${selection.examStudentIds.length}件`}
              title={GRADING_TARGET_MODE_DESCRIPTIONS[mode]}
              disabled={!isSelectable}
              tabIndex={mode === tabStopMode ? 0 : -1}
              onClick={() => onTargetModeChange(mode)}
              onKeyDown={(event) => moveFocus(event, mode)}
              className={cn(
                "flex flex-col items-start rounded-md border px-3 py-1.5 text-left transition-colors outline-none",
                "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-50",
                isChecked
                  ? "border-primary bg-primary/5 ring-2 ring-primary"
                  : "hover:bg-muted/60"
              )}
            >
              <span className="text-xs font-semibold">
                {GRADING_TARGET_MODE_LABELS[mode]}
              </span>
              <span className="leading-tight">
                <span
                  className="text-xl font-semibold tabular-nums"
                  data-testid={`ai-grading-target-count-${mode}`}
                >
                  {selection.examStudentIds.length}
                </span>
                <span className="ml-0.5 text-xs">件</span>
              </span>
              <span
                className="text-[11px] text-muted-foreground"
                data-testid={`ai-grading-target-excluded-${mode}`}
              >
                {exclusionText(selection)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="ai-grading-include-borderline"
          checked={includeBorderline}
          onCheckedChange={(checked) =>
            onIncludeBorderlineChange(checked === true)
          }
        />
        <Label
          htmlFor="ai-grading-include-borderline"
          className="text-sm font-normal"
        >
          白紙か際どい答案（境界帯）も送る
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="ai-grading-include-blank"
          checked={includeBlank}
          onCheckedChange={(checked) => onIncludeBlankChange(checked === true)}
        />
        <Label
          htmlFor="ai-grading-include-blank"
          className="text-sm font-normal"
        >
          白紙と判定した答案も送る
        </Label>
      </div>
      {targetMode !== null && (
        <p
          className="text-xs text-muted-foreground"
          data-testid="ai-grading-target-blank-summary"
        >
          {blankSummaryText(selectionByMode[targetMode], includeBlank)}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        白紙と判定した答案は、既定では送りません（判定はインク率によるので、薄い字などで外れることがあります）。インクを測れなかった答案は白紙とみなさずに送ります。
      </p>
    </div>
  )
}
