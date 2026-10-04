"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

import {
  GRADING_TARGET_MODE_DESCRIPTIONS,
  GRADING_TARGET_MODE_LABELS,
  GRADING_TARGET_MODES,
  type GradingTargetMode,
  type GradingTargetSelection,
} from "./utils/selectGradingTargets"

interface AiGradingTargetSelectorProps {
  targetMode: GradingTargetMode
  onTargetModeChange: (targetMode: GradingTargetMode) => void
  /** 選び方ごとの選択結果（件数を並べる） */
  selectionByMode: Record<GradingTargetMode, GradingTargetSelection>
  includeBorderline: boolean
  onIncludeBorderlineChange: (includeBorderline: boolean) => void
}

/** 採点する答案の選び方（設計 §3-2）。選び方ごとに送る件数と、除いた白紙の数を出す */
export function AiGradingTargetSelector({
  targetMode,
  onTargetModeChange,
  selectionByMode,
  includeBorderline,
  onIncludeBorderlineChange,
}: AiGradingTargetSelectorProps) {
  const selection = selectionByMode[targetMode]
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-medium">採点する答案</legend>
      <RadioGroup
        value={targetMode}
        onValueChange={(value) => {
          const nextTargetMode = GRADING_TARGET_MODES.find(
            (mode) => mode === value
          )
          if (nextTargetMode) onTargetModeChange(nextTargetMode)
        }}
        className="gap-1.5"
      >
        {GRADING_TARGET_MODES.map((mode) => {
          const itemId = `ai-grading-target-${mode}`
          return (
            <div key={mode} className="flex items-start gap-2">
              <RadioGroupItem value={mode} id={itemId} className="mt-0.5" />
              <Label
                htmlFor={itemId}
                className="flex flex-1 flex-col items-start gap-0 font-normal"
              >
                <span className="flex w-full items-center justify-between text-sm">
                  <span>{GRADING_TARGET_MODE_LABELS[mode]}</span>
                  <span
                    className="font-mono text-xs text-muted-foreground"
                    data-testid={`ai-grading-target-count-${mode}`}
                  >
                    {selectionByMode[mode].examStudentIds.length}件
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {GRADING_TARGET_MODE_DESCRIPTIONS[mode]}
                </span>
              </Label>
            </div>
          )
        })}
      </RadioGroup>

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

      <p className="text-xs text-muted-foreground">
        白紙の答案は送りません（この選び方で {selection.excludedBlankCount}
        件を除きました
        {selection.excludedBorderlineCount > 0 &&
          `。境界帯の ${selection.excludedBorderlineCount} 件も除いています`}
        ）。インクを測れなかった答案は白紙とみなさずに送ります。
      </p>
    </fieldset>
  )
}
