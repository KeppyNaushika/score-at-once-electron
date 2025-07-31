"use client"

import AnswerDisplayViewer from "@/components/projects/07-score-at-once/components/AnswerDisplayViewer"
import AnswerGridView from "@/components/projects/07-score-at-once/components/AnswerGridView"
import type { GradingMode } from "@/components/projects/07-score-at-once/components/GradingModeToggle"
import type { LayoutDirection, GridSize, ViewMode, ImagePosition } from "@/components/projects/07-score-at-once/components/scoring-main/types/scoring-main-types"

interface ScoringContentAreaProps {
  gradingMode: GradingMode
  // Individual mode props
  currentAnswerSheet?: any
  currentQuestion?: any
  viewMode: ViewMode
  imageZoom: number
  imagePosition: ImagePosition
  onZoomChange: (zoom: number) => void
  onPositionChange: (position: ImagePosition) => void
  onViewModeChange: (mode: ViewMode) => void
  // Grid mode props
  getGridAnswerData: () => any[]
  currentQuestionIndex: number
  layoutDirection: LayoutDirection
  gridSize: GridSize
  onAnswerSelect: (answerId: string, isSelected: boolean) => void
  onAnswerScore: (statusOrAnswerIds: any, statusOrPartialScore?: any, partialScore?: any) => void
  selectedAnswers: Set<string>
  onEffectiveColumnsChange: (columns: number) => void
  itemsPerRow: number[]
  autoScroll: boolean
  showStudentNames: boolean
}

export function ScoringContentArea({
  gradingMode,
  currentAnswerSheet,
  currentQuestion,
  viewMode,
  imageZoom,
  imagePosition,
  onZoomChange,
  onPositionChange,
  onViewModeChange,
  getGridAnswerData,
  currentQuestionIndex,
  layoutDirection,
  gridSize,
  onAnswerSelect,
  onAnswerScore,
  selectedAnswers,
  onEffectiveColumnsChange,
  itemsPerRow,
  autoScroll,
  showStudentNames,
}: ScoringContentAreaProps) {
  return (
    <div className="min-h-0 flex-1 p-6">
      {gradingMode === "individual" ? (
        <AnswerDisplayViewer
          answerSheet={currentAnswerSheet}
          currentQuestion={currentQuestion}
          viewMode={viewMode}
          zoom={imageZoom}
          position={imagePosition}
          onZoomChange={onZoomChange}
          onPositionChange={onPositionChange}
          onViewModeChange={onViewModeChange}
        />
      ) : (
        <AnswerGridView
          answers={getGridAnswerData()}
          currentQuestionIndex={currentQuestionIndex}
          layoutDirection={layoutDirection}
          gridSize={gridSize}
          onAnswerSelect={onAnswerSelect}
          onAnswerScore={onAnswerScore}
          selectedAnswers={selectedAnswers}
          onEffectiveColumnsChange={onEffectiveColumnsChange}
          itemsPerRow={itemsPerRow}
          autoScroll={autoScroll}
          showStudentNames={showStudentNames}
        />
      )}
    </div>
  )
}