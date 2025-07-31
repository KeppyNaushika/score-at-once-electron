"use client"

import NavigationControls from "@/components/projects/07-score-at-once/components/NavigationControls"
import ProjectProgressCard from "@/components/projects/07-score-at-once/components/ProjectProgressCard"
import QuestionNavigator from "@/components/projects/07-score-at-once/components/QuestionNavigator"
import ScoringToolbar from "@/components/projects/07-score-at-once/components/ScoringToolbar"
import type { LayoutDirection } from "@/components/projects/07-score-at-once/components/scoring-main/types/scoring-main-types"
import { QuestionProgress } from "@/components/projects/07-score-at-once/hooks/scoring-data/types/scoring-data-types"

interface ScoringSidePanelProps {
  projectId: string
  // Question Navigator props
  questionRegions: any[]
  currentQuestionIndex: number
  onQuestionChange: (index: number) => void
  onPrevQuestion: () => void
  onNextQuestion: () => void
  questionProgress: QuestionProgress
  // Scoring Toolbar props
  selectedAnswersCount: number
  currentQuestion?: any
  filterSettings: any
  onScore: (
    statusOrAnswerIds: any,
    statusOrPartialScore?: any,
    partialScore?: any,
  ) => void
  onToggleFilter: (filterId: string) => void
  onRefreshFilter: () => void
  partialScoreInput: string
  modifierKeyLabel: string
  // Navigation Controls props
  layoutDirection: LayoutDirection
  visibleAnswersCount: number
  totalAnswersCount: number
  onLayoutDirectionChange: (direction: LayoutDirection) => void
  onGridNavigation: (direction: string) => void
  onRefreshView: () => void
  itemsPerRow: number[]
  onItemsPerRowChange: (value: number[]) => void
  autoScroll: boolean
  onAutoScrollChange: (enabled: boolean) => void
}

export function ScoringSidePanel({
  projectId,
  questionRegions,
  currentQuestionIndex,
  onQuestionChange,
  onPrevQuestion,
  onNextQuestion,
  questionProgress,
  selectedAnswersCount,
  currentQuestion,
  filterSettings,
  onScore,
  onToggleFilter,
  onRefreshFilter,
  partialScoreInput,
  modifierKeyLabel,
  layoutDirection,
  visibleAnswersCount,
  totalAnswersCount,
  onLayoutDirectionChange,
  onGridNavigation,
  onRefreshView,
  itemsPerRow,
  onItemsPerRowChange,
  autoScroll,
  onAutoScrollChange,
}: ScoringSidePanelProps) {
  return (
    <div className="w-96 overflow-y-auto border-l border-gray-200 bg-gray-50 p-4">
      {/* 設問ナビゲーター */}
      <QuestionNavigator
        questionRegions={questionRegions}
        currentQuestionIndex={currentQuestionIndex}
        onQuestionChange={onQuestionChange}
        onPrevQuestion={onPrevQuestion}
        onNextQuestion={onNextQuestion}
        questionProgress={questionProgress}
      />

      {/* 採点ツールバー */}
      <ScoringToolbar
        selectedAnswersCount={selectedAnswersCount}
        currentQuestion={currentQuestion}
        filterSettings={filterSettings}
        onScore={onScore}
        onToggleFilter={onToggleFilter}
        onRefreshFilter={onRefreshFilter}
        partialScoreInput={partialScoreInput}
        modifierKeyLabel={modifierKeyLabel}
      />

      {/* ナビゲーション制御 */}
      <NavigationControls
        layoutDirection={layoutDirection}
        selectedAnswersCount={selectedAnswersCount}
        visibleAnswersCount={visibleAnswersCount}
        totalAnswersCount={totalAnswersCount}
        onLayoutDirectionChange={onLayoutDirectionChange}
        onGridNavigation={onGridNavigation}
        onRefreshView={onRefreshView}
        itemsPerRow={itemsPerRow}
        onItemsPerRowChange={onItemsPerRowChange}
        autoScroll={autoScroll}
        onAutoScrollChange={onAutoScrollChange}
      />

      {/* プロジェクト進捗 */}
      <ProjectProgressCard projectId={projectId} />
    </div>
  )
}
