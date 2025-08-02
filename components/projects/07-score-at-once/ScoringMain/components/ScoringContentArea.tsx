"use client"

import AnswerGridView from "@/components/projects/07-score-at-once/ScoringGrid/AnswerGridView"
import AnswerIndividualView from "@/components/projects/07-score-at-once/ScoringIndividual/AnswerIndividualView"
import type { LayoutDirection } from "@/components/projects/07-score-at-once/ScoringMain/types/scoring-main-types"
import type { ScoringData } from "@/components/projects/07-score-at-once/types/scoring-data.types"
import type { GradingMode } from "@/components/projects/07-score-at-once/types/shared.types"

interface ScoringContentAreaProps {
  gradingMode: GradingMode

  // 採点データ管理（両View共通）
  allScoringData: ScoringData[]
  filteredScoringDataIds: Set<string>
  selectedScoringDataIds: Set<string>

  // 共通設問情報（両View共通）
  currentQuestionIndex: number
  currentQuestion?: any

  // 操作関数（両View共通）
  onScoringDataSelect: (dataId: string, isSelected: boolean) => void
  onScoringDataScore: (
    statusOrAnswerIds: any,
    statusOrPartialScore?: any,
    partialScore?: any,
  ) => void

  // GridView設定
  layoutDirection: LayoutDirection
  itemsPerLine: number[]
  autoScroll: boolean
  showStudentNames: boolean

  // IndividualView設定
  allAnswerSheets?: any[] // Individual表示の複数ページ表示用（後で整理予定）

  // 生徒データコールバック（個別表示でサイドパネルに渡すため）
  onStudentsExtracted?: (students: any[]) => void
}

export function ScoringContentArea({
  gradingMode,
  allScoringData,
  filteredScoringDataIds,
  selectedScoringDataIds,
  currentQuestionIndex,
  currentQuestion,
  onScoringDataSelect,
  onScoringDataScore,
  layoutDirection,
  itemsPerLine,
  autoScroll,
  showStudentNames,
  allAnswerSheets,
}: ScoringContentAreaProps) {
  // 個別表示時：selectedの最初の要素、または存在しないときはallの最初の要素
  const currentScoringDataId =
    gradingMode === "individual"
      ? selectedScoringDataIds.size > 0
        ? Array.from(selectedScoringDataIds)[0]
        : allScoringData.length > 0
          ? allScoringData[0].id
          : null
      : null

  return (
    <div className="min-h-0 flex-1">
      {gradingMode === "individual" ? (
        <div className="p-6">
          <AnswerIndividualView
            allScoringData={allScoringData}
            currentScoringDataId={currentScoringDataId}
            currentQuestionIndex={currentQuestionIndex}
            currentQuestion={currentQuestion}
            allAnswerSheets={allAnswerSheets}
            onScoringDataScore={(
              statusOrAnswerIds,
              statusOrPartialScore,
              partialScore,
            ) => {
              // 個別表示モードでは現在の答案のみを対象にする
              if (currentScoringDataId) {
                onScoringDataScore(
                  [currentScoringDataId],
                  statusOrPartialScore,
                  partialScore,
                )
              }
            }}
          />
        </div>
      ) : (
        <div className="p-6">
          <AnswerGridView
            allScoringData={allScoringData}
            filteredScoringDataIds={filteredScoringDataIds}
            selectedScoringDataIds={selectedScoringDataIds}
            currentQuestionIndex={currentQuestionIndex}
            layoutDirection={layoutDirection}
            onScoringDataSelect={onScoringDataSelect}
            onScoringDataScore={onScoringDataScore}
            itemsPerRow={itemsPerLine}
            autoScroll={autoScroll}
            showStudentNames={showStudentNames}
          />
        </div>
      )}
    </div>
  )
}
