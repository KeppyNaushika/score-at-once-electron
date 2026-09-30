"use client"

import type { PlacementStrategySelectorProps } from "@/components/exams/06-student-answers/student-answer-table/types"
import type { PlacementStrategy } from "@/components/exams/06-student-answers/types"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const PLACEMENT_STRATEGIES: PlacementStrategy[] = [
  "page-first",
  "student-first",
]

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
        value={fileOrder}
        aria-label="配置戦略"
        onValueChange={(value) => {
          // 選択中をもう一度押すと空文字が来る。選択は外さない
          const nextPlacementStrategy = PLACEMENT_STRATEGIES.find(
            (candidatePlacementStrategy) => candidatePlacementStrategy === value
          )
          if (nextPlacementStrategy) onFileOrderChange(nextPlacementStrategy)
        }}
      >
        <ToggleGroupItem
          value="page-first"
          className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          ページ順
        </ToggleGroupItem>
        <ToggleGroupItem
          value="student-first"
          className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          生徒順
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
