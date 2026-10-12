"use client"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import type { ScaleQuestionState } from "@/components/exams/07-score-at-once/ScaleLevel/hooks/useScaleScoringGate"
import { ScaleLevelButtons } from "@/components/exams/07-score-at-once/ScaleLevel/ScaleLevelButtons"
import {
  BRUSH_BUTTONS,
  GRID_4_3_STYLE,
} from "@/components/exams/07-score-at-once/ScoringSidePanel/scoringToolbarButtons"
import { ShortcutTooltip } from "@/components/exams/07-score-at-once/ScoringSidePanel/ShortcutTooltip"
import { Button } from "@/components/ui/button"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { scoringCommandIdOf } from "@/lib/scoringKeybindings"
import { formatKeyForDisplay } from "@/lib/shortcutCatalog"
import { isStatusCompatibleWithScoringMethod } from "@/types/rubric.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

interface DecisionVerdictButtonsProps {
  disabled: boolean
  /** 選んでいる答案の数 */
  selectedCount: number
  onDecide: (status: Exclude<ScoringStatus, "unscored">) => void
  /** 今の設問の類型評価（類型評価の設問では類型のボタンを並べる） */
  scaleQuestion: ScaleQuestionState
  onDecideScaleLevel: (scaleLevelId: string) => void
}

/**
 * 確定の判定ボタン。07 の採点ボタンと同じ色・アイコン・キーで並べる
 * （未採点は確定の対象にならないので出さない）。
 *
 * 類型評価の設問では 07 と同じく、正答・誤答・部分点の代わりに類型のボタンを並べる
 * （§4-8-5「確定は類型を選ぶ」）。保留・無答・Wマークは残す。
 */
export function DecisionVerdictButtons({
  disabled,
  selectedCount,
  onDecide,
  scaleQuestion,
  onDecideScaleLevel,
}: DecisionVerdictButtonsProps) {
  const { keyBindings } = useKeyBindings()
  const scoringColors = useScoringStatusColors()
  const verdictButtons = scaleQuestion.isScaleQuestion
    ? BRUSH_BUTTONS.filter((button) =>
        isStatusCompatibleWithScoringMethod("scale", button.status)
      )
    : BRUSH_BUTTONS

  return (
    <div className="space-y-2">
      {scaleQuestion.isScaleQuestion && (
        <ScaleLevelButtons
          scaleLevels={scaleQuestion.scaleLevels}
          isScaleLevelsLoading={scaleQuestion.isScaleLevelsLoading}
          selectedAnswersCount={selectedCount}
          disabled={disabled}
          onApplyScaleLevel={onDecideScaleLevel}
        />
      )}
      <div style={GRID_4_3_STYLE}>
        {verdictButtons.map((button) => {
          const Icon = button.icon
          const keyBinding =
            keyBindings[scoringCommandIdOf(button.status)] || "?"
          const colors = scoringColors[button.status]
          return (
            <ShortcutTooltip
              key={button.status}
              description={`${button.label}で確定`}
              keys={[formatKeyForDisplay(keyBinding)]}
            >
              <Button
                variant="outline"
                size="sm"
                className={`flex h-12 flex-col gap-1 border-2 ${
                  disabled
                    ? "cursor-not-allowed opacity-50"
                    : "hover:opacity-80"
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
    </div>
  )
}
