"use client"

import AnswerGridView from "@/components/projects/07-score-at-once/ScoringGrid/AnswerGridView"
import AnswerIndividualView from "@/components/projects/07-score-at-once/ScoringIndividual/AnswerIndividualView"
import type {
  CropRegionWithProjectPage,
  GradingMode,
  LayoutDirection,
  PageImageWithProjectStudents,
  ScoringData,
} from "@/components/projects/07-score-at-once/types"

interface ScoringContentAreaProps {
  gradingMode: GradingMode

  // 採点データ管理（両View共通）
  allScoringData: ScoringData[]
  masterAnswerData: any // Grid表示用の模範解答データ
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
  pageImages?: PageImageWithProjectStudents[]

  // 生徒データコールバック（個別表示でサイドパネルに渡すため）
  onStudentsExtracted?: (students: any[]) => void
}

export function ScoringContentArea({
  gradingMode,
  allScoringData,
  masterAnswerData,
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
        // 個別表示はフルサイズ表示（paddingなし）
        <AnswerIndividualView
          scoringDatas={allScoringData}
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
      ) : (
        <div className="min-h-0 flex-1 p-6">
          <AnswerGridView
            allScoringData={allScoringData}
            masterAnswerData={masterAnswerData}
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
