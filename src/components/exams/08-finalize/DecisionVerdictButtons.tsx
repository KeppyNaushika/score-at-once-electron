"use client"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import {
  BRUSH_BUTTONS,
  GRID_4_3_STYLE,
} from "@/components/exams/07-score-at-once/ScoringSidePanel/scoringToolbarButtons"
import { ShortcutTooltip } from "@/components/exams/07-score-at-once/ScoringSidePanel/ShortcutTooltip"
import { Button } from "@/components/ui/button"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { scoringCommandIdOf } from "@/lib/scoringKeybindings"
import type { ScoringStatus } from "@/types/scoringStatus.types"

interface DecisionVerdictButtonsProps {
  disabled: boolean
  onDecide: (status: Exclude<ScoringStatus, "unscored">) => void
}

/**
 * 確定の判定ボタン。07 の採点ボタンと同じ色・アイコン・キーで並べる
 * （未採点は確定の対象にならないので出さない）。
 */
export function DecisionVerdictButtons({
  disabled,
  onDecide,
}: DecisionVerdictButtonsProps) {
  const { keyBindings } = useKeyBindings()
  const scoringColors = useScoringStatusColors()

  return (
    <div style={GRID_4_3_STYLE}>
      {BRUSH_BUTTONS.map((button) => {
        const Icon = button.icon
        const keyBinding = keyBindings[scoringCommandIdOf(button.status)] || "?"
        const colors = scoringColors[button.status]
        return (
          <ShortcutTooltip
            key={button.status}
            description={`${button.label}で確定`}
            keys={[keyBinding.toUpperCase()]}
          >
            <Button
              variant="outline"
              size="sm"
              className={`flex h-12 flex-col gap-1 border-2 ${
                disabled ? "cursor-not-allowed opacity-50" : "hover:opacity-80"
              }`}
              style={{
                backgroundColor: colors.bg,
                color: colors.text,
                borderColor: colors.bg,
              }}
              onClick={() => onDecide(button.status)}
              disabled={disabled}
            >
              <Icon className="h-4 w-4" />
              <div className="text-xs">{button.label}</div>
            </Button>
          </ShortcutTooltip>
        )
      })}
    </div>
  )
}
