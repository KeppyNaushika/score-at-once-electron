"use client"

import { QuestionProgress } from "@/components/exams/07-score-at-once/ScoringData/types/scoringDataTypes"
import { IndividualModePanel } from "@/components/exams/07-score-at-once/ScoringIndividual/IndividualModePanel"
import ExamProgressCard from "@/components/exams/07-score-at-once/ScoringSidePanel/ExamProgressCard"
import NavigationControls from "@/components/exams/07-score-at-once/ScoringSidePanel/NavigationControls"
import QuestionNavigator from "@/components/exams/07-score-at-once/ScoringSidePanel/QuestionNavigator"
import ScoringToolbar from "@/components/exams/07-score-at-once/ScoringSidePanel/ScoringToolbar"
import type {
  CropRegionWithExamPage,
  LayoutDirection,
  ScoringStatus,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import { Separator } from "@/components/ui/separator"

interface ScoringSidePanelProps {
  examId: string
  // Question Navigator props
  cropRegions: CropRegionWithExamPage[]
  currentCropRegion?: CropRegionWithExamPage | null
  onCropRegionChange: (cropRegion: CropRegionWithExamPage | null) => void
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
    partialScore?: number | null
  ) => void
  onToggleFilter: (filterId: string) => void
  onRefreshFilter: () => void
  partialScoreInput: string
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
  // 表示領域拡張
  expandMargin?: number
  onExpandMarginChange?: (value: number) => void
  // Individual mode props
  students?: {
    id: string
    studentNumber: string
    lastName: string
    firstName: string
    customOrder: number
  }[]
  onStudentChange?: (studentId: string) => void
  selectedStudentAnswerImageIds?: Set<string>
  studentAnswerImages?: StudentAnswerImageWithExamStudents[]
  scoringBehavior?: "next-student" | "next-question" | "stay"
  onScoringBehaviorChange?: (
    behavior: "next-student" | "next-question" | "stay"
  ) => void
}

export function ScoringSidePanel({
  examId,
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
  expandMargin,
  onExpandMarginChange,
  students,
  onStudentChange,
  selectedStudentAnswerImageIds,
  studentAnswerImages,
  scoringBehavior,
  onScoringBehaviorChange,
}: ScoringSidePanelProps) {
  return (
    <div className="w-96 overflow-y-auto border-l border-gray-200 bg-white px-4">
      {/* 設問ナビゲーター */}
      <QuestionNavigator
        questionRegions={cropRegions}
        currentCropRegion={currentCropRegion}
        onCropRegionChange={onCropRegionChange}
        onPrevQuestion={onPrevQuestion}
        onNextQuestion={onNextQuestion}
        questionProgress={questionProgress}
      />

      <Separator />

      {/* 採点ツールバー */}
      <ScoringToolbar
        selectedAnswersCount={selectedAnswersCount}
        currentCropRegion={currentCropRegion}
        filterSettings={filterSettings}
        onScore={onScore}
        onToggleFilter={onToggleFilter}
        onRefreshFilter={onRefreshFilter}
        partialScoreInput={partialScoreInput}
        gradingMode={gradingMode}
      />

      {/* 個別表示モード時：生徒選択パネル */}
      {gradingMode === "individual" &&
        students &&
        onStudentChange &&
        onScoringBehaviorChange &&
        scoringBehavior && (
          <>
            <Separator />
            <IndividualModePanel
              students={students}
              selectedAnswers={selectedStudentAnswerImageIds}
              studentAnswerImages={studentAnswerImages}
              onStudentChange={onStudentChange}
              scoringBehavior={scoringBehavior}
              onScoringBehaviorChange={onScoringBehaviorChange}
            />
          </>
        )}

      <Separator />

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
        expandMargin={expandMargin}
        onExpandMarginChange={onExpandMarginChange}
      />

      <Separator />

      {/* 試験進捗 */}
      <div className="py-3">
        <ExamProgressCard examId={examId} />
      </div>
    </div>
  )
}
