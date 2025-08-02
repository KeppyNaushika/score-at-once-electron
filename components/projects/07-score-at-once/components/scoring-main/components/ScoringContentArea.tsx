"use client"

import AnswerDisplayViewer from "@/components/projects/07-score-at-once/components/AnswerDisplayViewer"
import AnswerGridView from "@/components/projects/07-score-at-once/components/AnswerGridView"
import type { GradingMode } from "@/components/projects/07-score-at-once/components/GradingModeToggle"
import { IndividualModePanel } from "@/components/projects/07-score-at-once/components/individual-mode/IndividualModePanel"
import type { ScoringBehavior } from "@/components/projects/07-score-at-once/components/individual-mode/ScoringBehaviorSelector"
import type {
  GridSize,
  ImagePosition,
  LayoutDirection,
  ViewMode,
} from "@/components/projects/07-score-at-once/components/scoring-main/types/scoring-main-types"

interface ScoringContentAreaProps {
  gradingMode: GradingMode
  // Individual mode props
  currentAnswerSheet?: any
  currentQuestion?: any
  allAnswerSheets?: any[] // 複数ページ表示用
  students?: any[] // 個別表示用の生徒一覧
  currentStudentId?: string
  onStudentChange?: (studentId: string) => void
  scoringBehavior?: ScoringBehavior
  onScoringBehaviorChange?: (behavior: ScoringBehavior) => void
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
  onAnswerScore: (
    statusOrAnswerIds: any,
    statusOrPartialScore?: any,
    partialScore?: any,
  ) => void
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
  allAnswerSheets,
  students,
  currentStudentId,
  onStudentChange,
  scoringBehavior = "next-student",
  onScoringBehaviorChange,
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
    <div className="min-h-0 flex-1">
      {gradingMode === "individual" ? (
        <div className="flex h-full">
          <div className="flex-1 p-6">
            <AnswerDisplayViewer
              answerSheet={currentAnswerSheet}
              currentQuestion={currentQuestion}
              allAnswerSheets={allAnswerSheets}
              zoom={imageZoom}
              position={imagePosition}
              onZoomChange={onZoomChange}
              onPositionChange={onPositionChange}
            />
          </div>
          {students &&
            currentStudentId &&
            onStudentChange &&
            onScoringBehaviorChange && (
              <IndividualModePanel
                students={students}
                currentStudentId={currentStudentId}
                onStudentChange={onStudentChange}
                scoringBehavior={scoringBehavior}
                onScoringBehaviorChange={onScoringBehaviorChange}
              />
            )}
        </div>
      ) : (
        <div className="p-6">
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
        </div>
      )}
    </div>
  )
}
