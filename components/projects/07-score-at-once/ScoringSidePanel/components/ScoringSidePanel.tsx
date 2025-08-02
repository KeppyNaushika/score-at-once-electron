"use client"

import { IndividualModePanel } from "@/components/projects/07-score-at-once/ScoringIndividual/components/IndividualModePanel"
import type { LayoutDirection } from "@/components/projects/07-score-at-once/ScoringMain/types/scoring-main-types"
import NavigationControls from "@/components/projects/07-score-at-once/ScoringSidePanel/components/NavigationControls"
import ProjectProgressCard from "@/components/projects/07-score-at-once/ScoringSidePanel/components/ProjectProgressCard"
import QuestionNavigator from "@/components/projects/07-score-at-once/ScoringSidePanel/components/QuestionNavigator"
import ScoringToolbar from "@/components/projects/07-score-at-once/ScoringSidePanel/components/ScoringToolbar"
import { QuestionProgress } from "@/components/projects/07-score-at-once/hooks/scoring-data/types/scoring-data-types"

interface ScoringSidePanelProps {
  projectId: string
  // Question Navigator props
  cropRegions: any[]
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
  itemsPerLine: number[]
  onItemsPerLineChange: (value: number[]) => void
  autoScroll: boolean
  onAutoScrollChange: (enabled: boolean) => void
  gradingMode: "grid" | "individual"
  // Individual mode props
  students?: any[]
  onStudentChange?: (studentId: string) => void
  selectedAnswers?: Set<string>
  allAnswerSheets?: any[]
  scoringBehavior?: any
  onScoringBehaviorChange?: (behavior: any) => void
}

export function ScoringSidePanel({
  projectId,
  cropRegions,
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
  itemsPerLine,
  onItemsPerLineChange,
  autoScroll,
  onAutoScrollChange,
  gradingMode,
  students,
  onStudentChange,
  selectedAnswers,
  allAnswerSheets,
  scoringBehavior,
  onScoringBehaviorChange,
}: ScoringSidePanelProps) {
  return (
    <div className="w-96 overflow-y-auto border-l border-gray-200 bg-gray-50 p-4">
      {/* 設問ナビゲーター */}
      <QuestionNavigator
        questionRegions={cropRegions}
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
        gradingMode={gradingMode}
      />

      {/* 個別表示モード時：生徒選択パネル */}
      {gradingMode === "individual" &&
        students &&
        onStudentChange &&
        onScoringBehaviorChange && (
          <IndividualModePanel
            students={students}
            selectedAnswers={selectedAnswers}
            allAnswerSheets={allAnswerSheets}
            onStudentChange={onStudentChange}
            scoringBehavior={scoringBehavior}
            onScoringBehaviorChange={onScoringBehaviorChange}
          />
        )}

      {/* ナビゲーション制御 */}
      <NavigationControls
        layoutDirection={layoutDirection}
        selectedAnswersCount={selectedAnswersCount}
        visibleAnswersCount={visibleAnswersCount}
        totalAnswersCount={totalAnswersCount}
        onLayoutDirectionChange={onLayoutDirectionChange}
        onGridNavigation={onGridNavigation}
        onRefreshView={onRefreshView}
        itemsPerRow={itemsPerLine}
        onItemsPerRowChange={onItemsPerLineChange}
        autoScroll={autoScroll}
        onAutoScrollChange={onAutoScrollChange}
        gradingMode={gradingMode}
      />

      {/* プロジェクト進捗 */}
      <ProjectProgressCard projectId={projectId} />
    </div>
  )
}
