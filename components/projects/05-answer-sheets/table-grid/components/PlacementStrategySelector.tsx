"use client"

import { Button } from "@/components/ui/button"
import type { PlacementStrategy } from "@/types/answer-sheet.types"
import { FileImage, Users } from "lucide-react"

interface PlacementStrategySelectorProps {
  fileOrder: PlacementStrategy
  onFileOrderChange: (order: PlacementStrategy) => void
  mode?: "upload" | "view"
}

export function PlacementStrategySelector({
  fileOrder,
  onFileOrderChange,
  mode = "upload",
}: PlacementStrategySelectorProps) {
  // viewモードでは表示しない
  if (mode === "view") return null

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
      <span className="text-xs font-medium whitespace-nowrap">配置戦略</span>

      <Button
        onClick={() => onFileOrderChange("page-first")}
        variant={fileOrder === "page-first" ? "default" : "outline"}
        size="sm"
        className="h-8 px-2 py-1 text-xs"
      >
        <FileImage className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
        <span className="hidden sm:inline">ページ優先 (A→D→G / B→E→H)</span>
        <span className="sm:hidden">ページ優先</span>
      </Button>

      <Button
        onClick={() => onFileOrderChange("student-first")}
        variant={fileOrder === "student-first" ? "default" : "outline"}
        size="sm"
        className="h-8 px-2 py-1 text-xs"
      >
        <Users className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
        <span className="hidden sm:inline">生徒優先 (A→B→C / D→E→F)</span>
        <span className="sm:hidden">生徒優先</span>
      </Button>
    </div>
  )
}
