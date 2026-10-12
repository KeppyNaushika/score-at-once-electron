"use client"

import {
  ChevronDown,
  ChevronRight,
  ListChecks,
  TriangleAlert,
} from "lucide-react"

import { SCORING_METHOD_LABELS } from "@/components/exams/07-score-at-once/Rubric/utils/rubricEffectLabel"
import { Button } from "@/components/ui/button"
import type { CropRegionRow } from "@/queries/cropRegion"
import { toScoringMethod } from "@/types/rubric.types"

interface ScoringMethodToggleButtonProps {
  region: Pick<CropRegionRow, "scoringMethod" | "scoreScaleId">
  expanded: boolean
  onToggle: () => void
}

/**
 * 設問の行の「採点方式」のマス。閉じていても方式が分かるよう名前を出し、押すと行の中を開く。
 * 類型方式なのに類型表を選んでいない設問は類型を選べないので、閉じていても知らせる
 */
export function ScoringMethodToggleButton({
  region,
  expanded,
  onToggle,
}: ScoringMethodToggleButtonProps) {
  const scoringMethod = toScoringMethod(region.scoringMethod)
  const lacksScoreScale =
    scoringMethod === "scale" && region.scoreScaleId === null

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-expanded={expanded}
      title={
        lacksScoreScale
          ? "類型表を選んでいないので、類型を選べません"
          : undefined
      }
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={`h-7 gap-1 px-2 text-xs ${
        scoringMethod === "points" ? "text-muted-foreground" : "text-blue-600"
      }`}
    >
      {lacksScoreScale ? (
        <TriangleAlert className="h-3.5 w-3.5 text-amber-600" />
      ) : (
        <ListChecks className="h-3.5 w-3.5" />
      )}
      {SCORING_METHOD_LABELS[scoringMethod]}
      {expanded ? (
        <ChevronDown className="h-3 w-3" />
      ) : (
        <ChevronRight className="h-3 w-3" />
      )}
    </Button>
  )
}
