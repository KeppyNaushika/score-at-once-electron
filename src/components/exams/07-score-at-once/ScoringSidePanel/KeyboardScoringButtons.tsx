"use client"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import { Button } from "@/components/ui/button"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { scoringCommandIdOf } from "@/lib/scoringKeybindings"
import { formatKeyForDisplay } from "@/lib/shortcutCatalog"
import { isStatusCompatibleWithScoringMethod } from "@/types/rubric.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import {
  GRID_4_3_STYLE,
  SCORING_BUTTONS,
  STATUS_MAP,
} from "./scoringToolbarButtons"
import { ShortcutTooltip } from "./ShortcutTooltip"

/**
 * キーボードモードの採点ボタン（割り当てたキーを添える）。
 * 類型評価の設問では正答・誤答・部分点を出さない（類型は類型のボタンで付ける）
 */
export function KeyboardScoringButtons({
  selectedAnswersCount,
  onScore,
  isScaleQuestion = false,
}: {
  selectedAnswersCount: number
  onScore: (status: ScoringStatus) => void
  isScaleQuestion?: boolean
}) {
  const { keyBindings } = useKeyBindings()
  const scoringColors = useScoringStatusColors()
  return (
    <div style={GRID_4_3_STYLE}>
      {SCORING_BUTTONS.filter(
        (button) =>
          !isScaleQuestion ||
          isStatusCompatibleWithScoringMethod("scale", button.status)
      ).map((button) => {
        const Icon = button.icon
        const statusType = STATUS_MAP[button.status]
        const keyBinding = keyBindings[scoringCommandIdOf(statusType)] || "?"
        const colors = scoringColors[statusType]
        return (
          <ShortcutTooltip
            key={button.status}
            description={button.description}
            keys={[formatKeyForDisplay(keyBinding)]}
          >
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
          </ShortcutTooltip>
        )
      })}
    </div>
  )
}
