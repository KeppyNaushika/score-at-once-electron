"use client"

import type { PlacementStrategySelectorProps } from "@/components/exams/06-student-answers/student-answer-table/types"
import { PLACEMENT_STRATEGIES } from "@/components/exams/06-student-answers/types"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ignoreDeselect } from "@/lib/toggleSelection"

export function PlacementStrategySelector({
  fileOrder,
  onFileOrderChange,
}: PlacementStrategySelectorProps) {
  if (!onFileOrderChange) return null

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">配置戦略:</span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        selectedTone="primary"
        value={fileOrder}
        aria-label="配置戦略"
        onValueChange={ignoreDeselect(PLACEMENT_STRATEGIES, onFileOrderChange)}
      >
        <ToggleGroupItem value="page-first" className="px-3">
          ページ順
        </ToggleGroupItem>
        <ToggleGroupItem value="student-first" className="px-3">
          生徒順
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
