"use client"

import { Layout } from "lucide-react"

import NavigationControls from "@/components/exams/07-score-at-once/ScoringSidePanel/NavigationControls"
import type {
  AnswerSortOrder,
  LayoutDirection,
} from "@/components/exams/07-score-at-once/types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import { ScoringStatusFilterButtons } from "./ScoringStatusFilterButtons"
import { SidePanelSection } from "./SidePanelSection"

interface DisplaySectionProps {
  gradingMode: "grid" | "individual"
  selectedAnswersCount: number
  visibleAnswersCount: number
  totalAnswersCount: number
  filterSettings: Partial<Record<ScoringStatus, boolean>>
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
          <ScoringStatusFilterButtons
            filterSettings={filterSettings}
            onToggleFilter={onToggleFilter}
          />
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
