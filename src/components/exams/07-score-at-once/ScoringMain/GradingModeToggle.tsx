"use client"

import { Bot, Grid, type LucideIcon, User } from "lucide-react"

import type { GradingMode } from "@/components/exams/07-score-at-once/types"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAiGradingAvailability } from "@/hooks/useAiGradingAvailability"
import { ignoreDeselect } from "@/lib/toggleSelection"

interface GradingModeOption {
  mode: GradingMode
  label: string
  Icon: LucideIcon
}

const MANUAL_GRADING_MODE_OPTIONS: GradingModeOption[] = [
  { mode: "grid", label: "一覧表示", Icon: Grid },
  { mode: "individual", label: "個別表示", Icon: User },
]

/** AI採点（実験的機能）。同意して API キーを保存した事業者があるときだけ並べる（設計 §9-1） */
const AI_GRADING_MODE_OPTION: GradingModeOption = {
  mode: "ai",
  label: "AI採点",
  Icon: Bot,
}

interface GradingModeToggleProps {
  mode: GradingMode
  onModeChange: (mode: GradingMode) => void
  className?: string
}

export default function GradingModeToggle({
  mode,
  onModeChange,
  className = "",
}: GradingModeToggleProps) {
  const { unlockedProviders } = useAiGradingAvailability()
  const gradingModeOptions =
    unlockedProviders.length > 0
      ? [...MANUAL_GRADING_MODE_OPTIONS, AI_GRADING_MODE_OPTION]
      : MANUAL_GRADING_MODE_OPTIONS
  const gradingModes = gradingModeOptions.map(
    (gradingModeOption) => gradingModeOption.mode
  )

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm font-medium text-muted-foreground">
        採点モード:
      </span>
      {/* 採点画面はキーボード優先。Tab で1つずつ辿れる並びを保つため、矢印キーでの移動（roving focus）は切る */}
      <ToggleGroup
        type="single"
        size="sm"
        selectedTone="primary"
        rovingFocus={false}
        value={mode}
        aria-label="採点モード"
        className="rounded-lg border bg-muted p-1"
        onValueChange={ignoreDeselect(gradingModes, onModeChange)}
      >
        {gradingModeOptions.map((gradingModeOption) => (
          <ToggleGroupItem
            key={gradingModeOption.mode}
            value={gradingModeOption.mode}
            className="h-7 gap-1 rounded-md px-2 py-1 text-xs"
          >
            <gradingModeOption.Icon className="h-3 w-3" />
            {gradingModeOption.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
