"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

import {
  type GradingTargetScope,
  isGradingTargetScope,
} from "./utils/selectGradingTargets"

/** 選び方の見出しと説明 */
const GRADING_TARGET_SCOPE_TEXTS: Record<
  GradingTargetScope,
  { title: string; description: string }
> = {
  unscored: {
    title: "未採点の答案",
    description: "自分がまだ採点していない答案を送ります。",
  },
  non_blank: {
    title: "無答以外の全ての答案",
    description: "自分が無答を付けた答案を除いて、全て送ります。",
  },
  all: {
    title: "全ての答案",
    description: "自分が無答を付けた答案も含めて、全て送ります。",
  },
  selected: {
    title: "選択した答案",
    description: "中央の一覧で選んでいる答案を送ります。",
  },
  scored: {
    title: "無答以外の採点済みの答案",
    description:
      "自分が無答を付けた答案を除いて、採点済みの答案を全て送ります。",
  },
  scored_all: {
    title: "採点済みの全ての答案",
    description:
      "自分が無答を付けた答案も含めて、採点済みの答案を全て送ります。",
  },
}

interface AiRunTargetChoiceProps {
  /** 並べる選び方（AI 採点とチェックで違う） */
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
          const scopeText = GRADING_TARGET_SCOPE_TEXTS[targetScope]
          return (
            <div key={targetScope} className="flex items-start gap-3">
              <RadioGroupItem
                value={targetScope}
                id={`ai-run-target-${targetScope}`}
                disabled={isDisabled}
                className="mt-0.5"
              />
              <Label
                htmlFor={`ai-run-target-${targetScope}`}
                className="flex flex-col items-start gap-1 font-normal"
              >
                <span className="font-medium">
                  {scopeText.title}（{targetCountByScope[targetScope] ?? 0} 件）
                </span>
                <span className="text-xs text-muted-foreground">
                  {isDisabled
                    ? "中央の一覧に選んでいる答案が無いので選べません。"
                    : scopeText.description}
                </span>
              </Label>
            </div>
          )
        })}
      </RadioGroup>
    </div>
  )
}
