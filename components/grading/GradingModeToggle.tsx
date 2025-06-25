"use client"

import { Button } from "@/components/ui/button"
import { Grid, User } from "lucide-react"

export type GradingMode = "individual" | "grid"

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
          variant={mode === "individual" ? "default" : "ghost"}
          size="sm"
          onClick={() => onModeChange("individual")}
          className="gap-1 text-xs px-2 py-1 h-7"
        >
          <User className="h-3 w-3" />
          個別
        </Button>
        <Button
          variant={mode === "grid" ? "default" : "ghost"}
          size="sm"
          onClick={() => onModeChange("grid")}
          className="gap-1 text-xs px-2 py-1 h-7"
        >
          <Grid className="h-3 w-3" />
          一覧
        </Button>
      </div>
    </div>
  )
}