"use client"

import AnswerIndividualView from "@/components/projects/07-score-at-once/ScoringIndividual/AnswerIndividualView"
import AnswerGridView from "@/components/projects/07-score-at-once/ScoringGrid/AnswerGridView"
import type { GradingMode } from "@/components/projects/07-score-at-once/ScoringMain/components/GradingModeToggle"
import type {
  LayoutDirection,
} from "@/components/projects/07-score-at-once/ScoringMain/types/scoring-main-types"
import type { ScoringData } from "@/components/projects/07-score-at-once/types/scoring-data.types"

interface ScoringContentAreaProps {
  gradingMode: GradingMode
  
  // 採点データ管理
  allScoringData: ScoringData[]
  filteredScoringDataIds: Set<string>
  selectedScoringDataIds: Set<string>
  
  // 共通設問情報
  currentQuestion?: any
  allAnswerSheets?: any[] // Individual表示の複数ページ表示用（後で整理予定）
  
  // 操作関数
  onScoringDataSelect: (dataId: string, isSelected: boolean) => void
  onScoringDataScore: (
    statusOrAnswerIds: any,
    statusOrPartialScore?: any,
    partialScore?: any,
  ) => void
  
  // Grid表示設定
  currentQuestionIndex: number
  layoutDirection: LayoutDirection
  itemsPerLine: number[]
  autoScroll: boolean
  showStudentNames: boolean
}

export function ScoringContentArea({
  gradingMode,
  allScoringData,
  filteredScoringDataIds,
  selectedScoringDataIds,
  currentQuestion,
  allAnswerSheets,
  onScoringDataSelect,
  onScoringDataScore,
  currentQuestionIndex,
  layoutDirection,
  itemsPerLine,
  autoScroll,
  showStudentNames,
}: ScoringContentAreaProps) {
  // 現在選択中の採点データを取得（Individual表示用）
  const currentScoringData = selectedScoringDataIds.size > 0 
    ? allScoringData.find(data => selectedScoringDataIds.has(data.id))
    : null

  // フィルタリングされた採点データを取得（Grid表示用）
  const filteredScoringData = allScoringData
    .filter(data => filteredScoringDataIds.has(data.id))
    .map(data => ({
      ...data,
      isSelected: selectedScoringDataIds.has(data.id)
    }))

  return (
    <div className="min-h-0 flex-1">
      {gradingMode === "individual" ? (
        <div className="p-6">
          {currentScoringData ? (
            <AnswerIndividualView
              answerSheet={currentScoringData}
              currentQuestion={currentQuestion}
              allAnswerSheets={allAnswerSheets}
              selectedAnswers={selectedScoringDataIds}
              onAnswerScore={(
                statusOrAnswerIds,
                statusOrPartialScore,
                partialScore,
              ) => {
                // 個別表示モードでは選択されている答案のみを対象にする
                if (gradingMode === "individual" && selectedScoringDataIds.size > 0) {
                  const selectedAnswerId = Array.from(selectedScoringDataIds)[0]
                  onScoringDataScore(
                    [selectedAnswerId],
                    statusOrPartialScore,
                    partialScore,
                  )
                } else {
                  onScoringDataScore(
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
            answers={filteredScoringData}
            currentQuestionIndex={currentQuestionIndex}
            layoutDirection={layoutDirection}
            onAnswerSelect={onScoringDataSelect}
            onAnswerScore={onScoringDataScore}
            selectedAnswers={selectedScoringDataIds}
            itemsPerRow={itemsPerLine}
            autoScroll={autoScroll}
            showStudentNames={showStudentNames}
          />
        </div>
      )}
    </div>
  )
}
