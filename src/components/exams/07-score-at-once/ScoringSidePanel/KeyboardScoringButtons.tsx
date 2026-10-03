"use client"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { scoringCommandIdOf } from "@/lib/scoringKeybindings"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import { KeyHint } from "./KeyHint"
import {
  GRID_4_3_STYLE,
  SCORING_BUTTONS,
  STATUS_MAP,
} from "./scoringToolbarButtons"

/** キーボードモードの採点ボタン（割り当てたキーを添える） */
export function KeyboardScoringButtons({
  selectedAnswersCount,
  onScore,
}: {
  selectedAnswersCount: number
  onScore: (status: ScoringStatus) => void
}) {
  const { keyBindings } = useKeyBindings()
  const scoringColors = useScoringStatusColors()
  return (
    <div style={GRID_4_3_STYLE}>
      {SCORING_BUTTONS.map((button) => {
        const Icon = button.icon
        const statusType = STATUS_MAP[button.status]
        const keyBinding = keyBindings[scoringCommandIdOf(statusType)] || "?"
        const colors = scoringColors[statusType]
        return (
          <Tooltip key={button.status}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`flex h-12 flex-col gap-1 border-2 ${
                  selectedAnswersCount === 0
                    ? "cursor-not-allowed opacity-50"
                    : "hover:opacity-80"
                }`}
                style={{
                  backgroundColor: colors.bg,
                  color: colors.text,
                  borderColor: colors.bg,
                }}
                onClick={() => onScore(button.status)}
                disabled={selectedAnswersCount === 0}
              >
                <Icon className="h-4 w-4" />
                <div className="text-xs">{button.label}</div>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <div className="font-medium">{button.description}</div>
                <KeyHint label={keyBinding.toUpperCase()} />
              </div>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
