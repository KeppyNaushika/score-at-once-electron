"use client"

import { getDynamicScoreStatusConfig } from "@/components/exams/07-score-at-once/ScoringGrid/constants/scoreStatusConfig"
import { ShortcutTooltip } from "@/components/exams/07-score-at-once/ScoringSidePanel/ShortcutTooltip"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { SCORING_STATUS_LABELS } from "@/lib/scoringStatusColors"

import type { DemoStatus } from "./types"

/**
 * 採点ボタン列。本番 ScoringToolbar と完全に同一（ツールチップ含む。下表示）。
 * 一覧表示・個別表示どちらのデモでも使う。
 */
export function ScoringButtonRow({
  markOrder,
  rawKeys,
  onScore,
}: {
  markOrder: DemoStatus[]
  rawKeys: Record<DemoStatus, string>
  onScore: (status: DemoStatus) => void
}) {
  const colors = useScoringStatusColors()
  const statusConfigMap = getDynamicScoreStatusConfig(colors)
  if (markOrder.length === 0) return null
  return (
    <TooltipProvider delayDuration={300}>
      <div className="mt-4 flex flex-wrap gap-2">
        {markOrder.map((status) => {
          const statusColor = colors[status]
          const Icon = statusConfigMap[status].icon
          const keyLabel = (rawKeys[status] || "?").toUpperCase()
          return (
            <ShortcutTooltip
              key={status}
              description={`${SCORING_STATUS_LABELS[status]}にする`}
              keys={[keyLabel]}
              side="bottom"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onScore(status)}
                className="flex h-12 w-16 flex-col gap-1 border-2 hover:opacity-80"
                style={{
                  backgroundColor: statusColor.bg,
                  color: statusColor.text,
                  borderColor: statusColor.bg,
                }}
              >
                <Icon className="h-4 w-4" />
                <div className="text-xs">{SCORING_STATUS_LABELS[status]}</div>
              </Button>
            </ShortcutTooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
