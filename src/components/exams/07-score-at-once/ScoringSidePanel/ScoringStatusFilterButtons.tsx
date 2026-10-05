"use client"

import {
  AlertTriangle,
  CheckCircle,
  Circle,
  Clock,
  CopyX,
  Minus,
  X,
} from "lucide-react"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { filterCommandIdOf } from "@/lib/scoringKeybindings"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import { GRID_4_3_STYLE } from "./scoringToolbarButtons"
import { ShortcutTooltip } from "./ShortcutTooltip"

const FILTER_BUTTONS = [
  { status: "unscored", label: "未採点", icon: Circle },
  { status: "correct", label: "正答", icon: CheckCircle },
  { status: "partial", label: "部分点", icon: AlertTriangle },
  { status: "pending", label: "保留", icon: Clock },
  { status: "incorrect", label: "誤答", icon: X },
  { status: "no_answer", label: "無答", icon: Minus },
  { status: "double_mark", label: "Wマーク", icon: CopyX },
] as const

interface ScoringStatusFilterButtonsProps {
  /** 状態ごとの表示の有無（無い状態は非表示として扱う） */
  filterSettings: Partial<Record<ScoringStatus, boolean>>
  onToggleFilter: (status: ScoringStatus) => void
}

/**
 * 採点状態の絞り込みボタン（7色）。一覧表示の「表示」節と AI採点モードで同じものを使う。
 * 色は採点状態の色、ツールチップには絞り込みのキー（`filter.toggle*`）を出す
 */
export function ScoringStatusFilterButtons({
  filterSettings,
  onToggleFilter,
}: ScoringStatusFilterButtonsProps) {
  const { keyBindings } = useKeyBindings()
  const scoringColors = useScoringStatusColors()

  return (
    <TooltipProvider delayDuration={300}>
      <div style={GRID_4_3_STYLE}>
        {FILTER_BUTTONS.map((button) => {
          const Icon = button.icon
          const isActive = filterSettings[button.status] ?? false
          const keyBinding =
            keyBindings[filterCommandIdOf(button.status)] || "?"
          const colors = scoringColors[button.status]
          return (
            <ShortcutTooltip
              key={button.status}
              description={`${button.label}を${isActive ? "非表示" : "表示"}`}
              keys={[keyBinding.toUpperCase()]}
            >
              <Button
                variant="outline"
                size="sm"
                aria-pressed={isActive}
                className="flex h-10 w-full min-w-0 items-center gap-1 border-2 px-1"
                style={
                  isActive
                    ? {
                        backgroundColor: colors.bg,
                        color: colors.text,
                        borderColor: colors.icon,
                      }
                    : {
                        backgroundColor: "transparent",
                        color: colors.icon,
                        borderColor: colors.icon,
                      }
                }
                onClick={() => onToggleFilter(button.status)}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="w-10 shrink-0 text-center text-[10px]">
                  {button.label}
                </span>
              </Button>
            </ShortcutTooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
