"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

import {
  type GradingTargetScope,
  isGradingTargetScope,
} from "./utils/selectGradingTargets"

/** 選び方の見出し */
const GRADING_TARGET_SCOPE_TITLES: Record<GradingTargetScope, string> = {
  unscored: "未採点の答案",
  non_blank: "無答以外の全ての答案",
  all: "全ての答案",
  selected: "選択した答案",
  scored: "無答以外の採点済みの答案",
  scored_all: "採点済みの全ての答案",
}

interface AiRunTargetChoiceProps {
  /** 並べる選び方（AI採点とチェックで違う） */
  scopes: readonly GradingTargetScope[]
  scope: GradingTargetScope
  onScopeChange: (scope: GradingTargetScope) => void
  /** 選び方ごとの送る答案の件数 */
  targetCountByScope: Partial<Record<GradingTargetScope, number>>
}

/** 送る答案の選び方（矢印キーで選べる） */
export function AiRunTargetChoice({
  scopes,
  scope,
  onScopeChange,
  targetCountByScope,
}: AiRunTargetChoiceProps) {
  const isSelectionEmpty = (targetCountByScope.selected ?? 0) === 0
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <p id="ai-run-target-label" className="font-medium">
        送る答案
      </p>
      <RadioGroup
        value={scope}
        onValueChange={(value) => {
          if (isGradingTargetScope(value)) onScopeChange(value)
        }}
        aria-labelledby="ai-run-target-label"
        className="gap-2"
      >
        {scopes.map((targetScope) => {
          const isDisabled = targetScope === "selected" && isSelectionEmpty
          return (
            <div key={targetScope} className="flex items-center gap-3">
              <RadioGroupItem
                value={targetScope}
                id={`ai-run-target-${targetScope}`}
                disabled={isDisabled}
              />
              <Label
                htmlFor={`ai-run-target-${targetScope}`}
                className="flex flex-col items-start gap-1 font-normal"
              >
                <span className="font-medium">
                  {GRADING_TARGET_SCOPE_TITLES[targetScope]}（
                  {targetCountByScope[targetScope] ?? 0} 件）
                </span>
              </Label>
            </div>
          )
        })}
      </RadioGroup>
    </div>
  )
}
