"use client"

import { Grid, User } from "lucide-react"

import type { GradingMode } from "@/components/exams/07-score-at-once/types"
import { Button } from "@/components/ui/button"

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
      <div className="flex rounded-lg border bg-muted p-1">
        <Button
          variant={mode === "grid" ? "default" : "ghost"}
          size="sm"
          onClick={() => onModeChange("grid")}
          className="h-7 gap-1 px-2 py-1 text-xs"
        >
          <Grid className="h-3 w-3" />
          一覧表示
        </Button>
        <Button
          variant={mode === "individual" ? "default" : "ghost"}
          size="sm"
          onClick={() => onModeChange("individual")}
          className="h-7 gap-1 px-2 py-1 text-xs"
        >
          <User className="h-3 w-3" />
          個別表示
        </Button>
      </div>
    </div>
  )
}
