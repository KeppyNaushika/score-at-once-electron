"use client"

import AnswerIndividualView from "@/components/projects/07-score-at-once/ScoringIndividual/AnswerIndividualView"
import AnswerGridView from "@/components/projects/07-score-at-once/ScoringGrid/AnswerGridView"
import type { GradingMode } from "@/components/projects/07-score-at-once/ScoringMain/components/GradingModeToggle"
import type {
  LayoutDirection,
} from "@/components/projects/07-score-at-once/ScoringMain/types/scoring-main-types"

interface ScoringContentAreaProps {
  gradingMode: GradingMode
  // Individual mode props
  currentAnswerSheet?: any
  currentQuestion?: any
  allAnswerSheets?: any[] // 複数ページ表示用
  // Grid mode props
  getGridAnswerData: () => any[]
  currentQuestionIndex: number
  layoutDirection: LayoutDirection
  onAnswerSelect: (answerId: string, isSelected: boolean) => void
  onAnswerScore: (
    statusOrAnswerIds: any,
    statusOrPartialScore?: any,
    partialScore?: any,
  ) => void
  selectedAnswers: Set<string>
  itemsPerLine: number[]
  autoScroll: boolean
  showStudentNames: boolean
}

export function ScoringContentArea({
  gradingMode,
  currentAnswerSheet,
  currentQuestion,
  allAnswerSheets,
  getGridAnswerData,
  currentQuestionIndex,
  layoutDirection,
  onAnswerSelect,
  onAnswerScore,
  selectedAnswers,
  itemsPerLine,
  autoScroll,
  showStudentNames,
}: ScoringContentAreaProps) {
  return (
    <div className="min-h-0 flex-1">
      {gradingMode === "individual" ? (
        <div className="p-6">
          {currentAnswerSheet ? (
            <AnswerIndividualView
              answerSheet={currentAnswerSheet}
              currentQuestion={currentQuestion}
              allAnswerSheets={allAnswerSheets}
              selectedAnswers={selectedAnswers}
              onAnswerScore={(
                statusOrAnswerIds,
                statusOrPartialScore,
                partialScore,
              ) => {
                // 個別表示モードでは選択されている答案のみを対象にする
                if (gradingMode === "individual" && selectedAnswers.size > 0) {
                  const selectedAnswerId = Array.from(selectedAnswers)[0]
                  onAnswerScore(
                    [selectedAnswerId],
                    statusOrPartialScore,
                    partialScore,
                  )
                } else {
                  onAnswerScore(
                    statusOrAnswerIds,
                    statusOrPartialScore,
                    partialScore,
                  )
                }
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gray-50 text-gray-500">
              生徒を選択してください
            </div>
          )}
        </div>
      ) : (
        <div className="p-6">
          <AnswerGridView
            answers={getGridAnswerData()}
            currentQuestionIndex={currentQuestionIndex}
            layoutDirection={layoutDirection}
            onAnswerSelect={onAnswerSelect}
            onAnswerScore={onAnswerScore}
            selectedAnswers={selectedAnswers}
            itemsPerRow={itemsPerLine}
            autoScroll={autoScroll}
            showStudentNames={showStudentNames}
          />
        </div>
      )}
    </div>
  )
}
