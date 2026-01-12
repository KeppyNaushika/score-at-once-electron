"use client"

import { Grid, User } from "lucide-react"

import type { GradingMode } from "@/components/projects/07-score-at-once/types"
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
      <span className="text-muted-foreground text-sm font-medium">
        採点モード:
      </span>
      <div className="bg-muted flex rounded-lg border p-1">
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
