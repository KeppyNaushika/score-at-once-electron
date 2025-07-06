"use client"

import type { PlacementStrategySelectorProps } from "@/components/projects/05-answer-sheets/answer-sheet-table/types"
import { Button } from "@/components/ui/button"

export function PlacementStrategySelector({
  fileOrder,
  onFileOrderChange,
}: PlacementStrategySelectorProps) {
  if (!onFileOrderChange) return null

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">配置戦略:</span>
      <div className="flex rounded-md border">
        <Button
          variant={fileOrder === "page-first" ? "default" : "ghost"}
          size="sm"
          onClick={() => onFileOrderChange("page-first")}
          className="rounded-r-none border-r"
        >
          ページ順
        </Button>
        <Button
          variant={fileOrder === "student-first" ? "default" : "ghost"}
          size="sm"
          onClick={() => onFileOrderChange("student-first")}
          className="rounded-l-none"
        >
          生徒順
        </Button>
      </div>
      {fileOrder === "filename-auto" && (
        <span className="text-xs text-gray-500">(ファイル名自動配置)</span>
      )}
    </div>
  )
}
