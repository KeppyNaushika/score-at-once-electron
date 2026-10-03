"use client"

import { Grid, type LucideIcon, User } from "lucide-react"

import type { GradingMode } from "@/components/exams/07-score-at-once/types"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ignoreDeselect } from "@/lib/toggleSelection"

interface GradingModeOption {
  mode: GradingMode
  label: string
  Icon: LucideIcon
}

const GRADING_MODE_OPTIONS: GradingModeOption[] = [
  { mode: "grid", label: "一覧表示", Icon: Grid },
  { mode: "individual", label: "個別表示", Icon: User },
]

const GRADING_MODES = GRADING_MODE_OPTIONS.map(
  (gradingModeOption) => gradingModeOption.mode
)

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
        onValueChange={ignoreDeselect(GRADING_MODES, onModeChange)}
      >
        {GRADING_MODE_OPTIONS.map((gradingModeOption) => (
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
