"use client"

import AnswerGridView from "@/components/projects/07-score-at-once/ScoringGrid/AnswerGridView"
import AnswerIndividualView from "@/components/projects/07-score-at-once/ScoringIndividual/AnswerIndividualView"
import type { ScoringData } from "@/components/projects/07-score-at-once/types"
import type {
  CropRegionWithProjectPage,
  GradingMode,
  LayoutDirection,
} from "@/components/projects/07-score-at-once/types"

interface ScoringContentAreaProps {
  gradingMode: GradingMode

  // 採点データ管理（両View共通）
  allScoringData: ScoringData[]
  filteredScoringDataIds: Set<string>
  selectedScoringDataIds: Set<string>

  // 設問情報（Individual表示のみ必要）
  currentCropRegion?: CropRegionWithProjectPage

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
  pageImages?: any[] // PageImageWithProjectStudents[] - Individual表示の複数ページ表示用

  // 生徒データコールバック（個別表示でサイドパネルに渡すため）
  onStudentsExtracted?: (students: any[]) => void
}

export function ScoringContentArea({
  gradingMode,
  allScoringData,
  filteredScoringDataIds,
  selectedScoringDataIds,
  currentCropRegion,
  onScoringDataSelect,
  onScoringDataScore,
  layoutDirection,
  itemsPerLine,
  autoScroll,
  showStudentNames,
  pageImages,
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
            scoringData={allScoringData}
            currentScoringDataId={currentScoringDataId}
            currentCropRegion={currentCropRegion}
            pageImages={pageImages}
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
            // Grid表示では設問情報不要
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
