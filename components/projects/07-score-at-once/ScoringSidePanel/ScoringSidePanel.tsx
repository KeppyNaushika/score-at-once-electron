"use client"

import { IndividualModePanel } from "@/components/projects/07-score-at-once/ScoringIndividual/IndividualModePanel"
import NavigationControls from "@/components/projects/07-score-at-once/ScoringSidePanel/NavigationControls"
import ProjectProgressCard from "@/components/projects/07-score-at-once/ScoringSidePanel/ProjectProgressCard"
import QuestionNavigator from "@/components/projects/07-score-at-once/ScoringSidePanel/QuestionNavigator"
import ScoringToolbar from "@/components/projects/07-score-at-once/ScoringSidePanel/ScoringToolbar"
import { QuestionProgress } from "@/components/projects/07-score-at-once/ScoringData/types/scoring-data-types"
import type {
  CropRegionWithProjectPage,
  LayoutDirection,
  ScoringStatus,
} from "@/components/projects/07-score-at-once/types"

interface ScoringSidePanelProps {
  projectId: string
  // Question Navigator props
  cropRegions: CropRegionWithProjectPage[]
  currentCropRegion?: CropRegionWithProjectPage | null
  onCropRegionChange: (cropRegion: CropRegionWithProjectPage | null) => void
  onPrevQuestion: () => void
  onNextQuestion: () => void
  questionProgress: QuestionProgress
  // Scoring Toolbar props
  selectedAnswersCount: number
  // currentCropRegion は上記で統一済み
  filterSettings: {
    unscored: boolean
    correct: boolean
    incorrect: boolean
    partial: boolean
    pending: boolean
    no_answer: boolean
  }
  onScore: (
    statusOrAnswerIds: ScoringStatus | string | string[],
    statusOrPartialScore?: ScoringStatus | number | null,
    partialScore?: number | null,
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
  students?: {
    id: string
    studentId: string
    lastName: string
    firstName: string
    customOrder: number
  }[]
  onStudentChange?: (studentId: string) => void
  selectedPageImageIds?: Set<string>
  pageImages?: any[] // PageImageWithProjectStudents[] - 具体的な型に変更予定
  scoringBehavior?: "next-student" | "next-question" | "stay"
  onScoringBehaviorChange?: (
    behavior: "next-student" | "next-question" | "stay",
  ) => void
}

export function ScoringSidePanel({
  projectId,
  cropRegions,
  currentCropRegion,
  onCropRegionChange,
  onPrevQuestion,
  onNextQuestion,
  questionProgress,
  selectedAnswersCount,
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
  selectedPageImageIds,
  pageImages,
  scoringBehavior,
  onScoringBehaviorChange,
}: ScoringSidePanelProps) {
  return (
    <div className="w-96 overflow-y-auto border-l border-gray-200 bg-gray-50 p-4">
      {/* 設問ナビゲーター */}
      <QuestionNavigator
        questionRegions={cropRegions}
        currentCropRegion={currentCropRegion}
        onCropRegionChange={onCropRegionChange}
        onPrevQuestion={onPrevQuestion}
        onNextQuestion={onNextQuestion}
        questionProgress={questionProgress}
      />

      {/* 採点ツールバー */}
      <ScoringToolbar
        selectedAnswersCount={selectedAnswersCount}
        currentCropRegion={currentCropRegion}
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
        onScoringBehaviorChange &&
        scoringBehavior && (
          <IndividualModePanel
            students={students}
            selectedAnswers={selectedPageImageIds}
            pageImages={pageImages}
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
