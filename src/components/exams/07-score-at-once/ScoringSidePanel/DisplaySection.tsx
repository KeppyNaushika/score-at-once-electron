"use client"

import {
  AlertTriangle,
  CheckCircle,
  Circle,
  Clock,
  CopyX,
  Layout,
  Minus,
  X,
} from "lucide-react"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import NavigationControls from "@/components/exams/07-score-at-once/ScoringSidePanel/NavigationControls"
import type {
  AnswerSortOrder,
  LayoutDirection,
} from "@/components/exams/07-score-at-once/types"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { filterCommandIdOf } from "@/lib/scoringKeybindings"

import { GRID_4_3_STYLE, STATUS_MAP } from "./scoringToolbarButtons"
import { ShortcutTooltip } from "./ShortcutTooltip"
import { SidePanelSection } from "./SidePanelSection"

const FILTER_BUTTONS = [
  { key: "unscored", label: "未採点", icon: Circle },
  { key: "correct", label: "正答", icon: CheckCircle },
  { key: "partial", label: "部分点", icon: AlertTriangle },
  { key: "pending", label: "保留", icon: Clock },
  { key: "incorrect", label: "誤答", icon: X },
  { key: "no_answer", label: "無答", icon: Minus },
  { key: "double_mark", label: "Wマーク", icon: CopyX },
] as const

interface DisplaySectionProps {
  gradingMode: "grid" | "individual"
  selectedAnswersCount: number
  visibleAnswersCount: number
  totalAnswersCount: number
  filterSettings: {
    unscored: boolean
    correct: boolean
    incorrect: boolean
    partial: boolean
    pending: boolean
    no_answer: boolean
  }
  onToggleFilter: (filterId: string) => void
  layoutDirection: LayoutDirection
  onLayoutDirectionChange: (direction: LayoutDirection) => void
  itemsPerLine: number[]
  onItemsPerLineChange: (value: number[]) => void
  expandMargin?: number
  onExpandMarginChange?: (value: number) => void
  answerSortOrder: AnswerSortOrder
  onAnswerSortOrderChange: (order: AnswerSortOrder) => void
  isWhitenessReady: boolean
  isOpen: boolean
  onToggle: () => void
}

/** サイドパネルの「表示」節（件数・表示フィルター・並べ方） */
export function DisplaySection({
  gradingMode,
  selectedAnswersCount,
  visibleAnswersCount,
  totalAnswersCount,
  filterSettings,
  onToggleFilter,
  layoutDirection,
  onLayoutDirectionChange,
  itemsPerLine,
  onItemsPerLineChange,
  expandMargin,
  onExpandMarginChange,
  answerSortOrder,
  onAnswerSortOrderChange,
  isWhitenessReady,
  isOpen,
  onToggle,
}: DisplaySectionProps) {
  const { keyBindings } = useKeyBindings()
  const scoringColors = useScoringStatusColors()

  return (
    <SidePanelSection
      icon={Layout}
      title="表示"
      collapsible
      isOpen={isOpen}
      onToggle={onToggle}
      rightElement={
        gradingMode === "grid" ? (
          <div className="flex items-center gap-0.5 text-[10px] text-gray-500">
            {selectedAnswersCount > 0 && (
              <>
                <span>選択</span>
                <span className="font-medium text-blue-600">
                  {selectedAnswersCount}
                </span>
                <span className="text-gray-300">|</span>
              </>
            )}
            <span>表示</span>
            <span className="font-medium">{visibleAnswersCount}</span>
            <span className="text-gray-300">|</span>
            <span>全体</span>
            <span className="font-medium">{totalAnswersCount}</span>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {/* 表示フィルター */}
        {gradingMode === "grid" && onToggleFilter && (
          <TooltipProvider delayDuration={300}>
            <div style={GRID_4_3_STYLE}>
              {FILTER_BUTTONS.map((button) => {
                const Icon = button.icon
                const isActive =
                  filterSettings[button.key as keyof typeof filterSettings]
                const keyBinding =
                  keyBindings[filterCommandIdOf(STATUS_MAP[button.key])] || "?"
                const colors = scoringColors[STATUS_MAP[button.key]]
                return (
                  <ShortcutTooltip
                    key={button.key}
                    description={`${button.label}を${isActive ? "非表示" : "表示"}`}
                    keys={[keyBinding.toUpperCase()]}
                  >
                    <Button
                      variant="outline"
                      size="sm"
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
                      onClick={() => onToggleFilter(button.key)}
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
        )}

        {/* レイアウト・表示設定 */}
        <NavigationControls
          layoutDirection={layoutDirection}
          onLayoutDirectionChange={onLayoutDirectionChange}
          itemsPerRow={itemsPerLine}
          onItemsPerRowChange={onItemsPerLineChange}
          gradingMode={gradingMode}
          expandMargin={expandMargin}
          onExpandMarginChange={onExpandMarginChange}
          answerSortOrder={answerSortOrder}
          onAnswerSortOrderChange={onAnswerSortOrderChange}
          isWhitenessReady={isWhitenessReady}
        />
      </div>
    </SidePanelSection>
  )
}
