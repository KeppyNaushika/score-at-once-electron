"use client"

import { Badge } from "@/components/ui/badge"
import type { ScoreScaleRow } from "@/queries/scoreScale"

import { scaleLevelsSummary } from "./utils/scoreScaleUsage"

interface ScoreScaleListItemProps {
  scoreScale: ScoreScaleRow
  isSelected: boolean
  onSelect: () => void
}

/**
 * 類型表管理の一覧の1件。名前・使える範囲（共通か、どの試験のものか）・類型・
 * どの試験のどの設問が使っているかを示す
 */
export function ScoreScaleListItem({
  scoreScale,
  isSelected,
  onSelect,
}: ScoreScaleListItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`w-full space-y-1 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 ${
        isSelected ? "border-primary bg-primary/10" : "bg-background"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="truncate font-medium">
          {scoreScale.name || "名前なし"}
        </span>
        <Badge variant={scoreScale.examId === null ? "default" : "outline"}>
          {scoreScale.examId === null
            ? "共通"
            : (scoreScale.exam?.examName ?? "試験")}
        </Badge>
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {scaleLevelsSummary(scoreScale.levels)}
      </p>
      {scoreScale.cropRegions.length === 0 ? (
        <p className="text-xs text-muted-foreground">使っている設問なし</p>
      ) : (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {scoreScale.cropRegions.map((cropRegion) => (
            <li key={cropRegion.id} className="truncate">
              {cropRegion.examPage.exam.examName} /{" "}
              {cropRegion.label || "（ラベルなし）"}
            </li>
          ))}
        </ul>
      )}
    </button>
  )
}
