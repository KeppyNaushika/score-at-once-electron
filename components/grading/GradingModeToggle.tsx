"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Grid, User, ToggleLeft, ToggleRight } from "lucide-react"

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
    <Card className={`w-fit ${className}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            採点モード:
          </span>
          <div className="flex rounded-lg border bg-muted p-1">
            <Button
              variant={mode === "individual" ? "default" : "ghost"}
              size="sm"
              onClick={() => onModeChange("individual")}
              className="gap-2 text-xs"
            >
              <User className="h-3.5 w-3.5" />
              個別採点
            </Button>
            <Button
              variant={mode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => onModeChange("grid")}
              className="gap-2 text-xs"
            >
              <Grid className="h-3.5 w-3.5" />
              一覧採点
            </Button>
          </div>
        </div>
        
        <div className="mt-2 text-xs text-muted-foreground">
          {mode === "individual" ? (
            <span>記述・作文問題に最適。1つずつ詳細に採点</span>
          ) : (
            <span>マークシート・短答問題に最適。効率的な一括採点</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}