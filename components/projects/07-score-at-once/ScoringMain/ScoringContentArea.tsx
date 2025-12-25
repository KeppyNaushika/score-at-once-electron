"use client"

import AnswerGridView from "@/components/projects/07-score-at-once/ScoringGrid/AnswerGridView"
import AnswerIndividualView from "@/components/projects/07-score-at-once/ScoringIndividual/AnswerIndividualView"
import type {
  CropRegionWithProjectPage,
  GradingMode,
  LayoutDirection,
  MasterAnswerData,
  PageImageWithProjectStudents,
  QuestionScore,
  ScoringData,
} from "@/components/projects/07-score-at-once/types"

interface ScoringContentAreaProps {
  gradingMode: GradingMode

  /** 採点データ管理（両View共通） */
  allScoringData: ScoringData[]
  masterAnswerData: MasterAnswerData | null
  filteredScoringDataIds: string[]
  selectedScoringDataIds: Set<string>

  /** 設問情報（Individual表示のみ必要） */
  currentCropRegion?: CropRegionWithProjectPage

  /** 操作関数（両View共通） */
  onScoringDataSelect: (dataId: string, isSelected: boolean) => void
  onScoringDataReplace?: (ids: string[]) => void
  onScoringDataScore: (
    statusOrAnswerIds: any,
    statusOrPartialScore?: any,
    partialScore?: any,
  ) => void

  /** GridView設定 */
  layoutDirection: LayoutDirection
  itemsPerLine: number[]
  autoScroll: boolean
  showStudentNames: boolean

  /** IndividualView設定 */
  pageImages?: PageImageWithProjectStudents[]

  /** 生徒データコールバック（個別表示でサイドパネルに渡すため） */
  onStudentsExtracted?: (students: any[]) => void

  /** テキスト入力状態変更のコールバック（ショートカット制御用） */
  onTextInputStateChange?: (showTextInput: boolean) => void

  /** QuestionScore自動作成用のコンテキスト情報 */
  currentStudentId?: string
  currentUserId?: string

  /** アノテーション用: QuestionScore配列 */
  questionScores?: QuestionScore[]
}

export function ScoringContentArea({
  gradingMode,
  allScoringData,
  masterAnswerData,
  filteredScoringDataIds,
  selectedScoringDataIds,
  currentCropRegion,
  onScoringDataSelect,
  onScoringDataReplace,
  onScoringDataScore,
  layoutDirection,
  itemsPerLine,
  autoScroll,
  showStudentNames,
  pageImages,
  onStudentsExtracted,
  onTextInputStateChange,
  currentStudentId,
  currentUserId,
  questionScores,
}: ScoringContentAreaProps) {
  /** 個別表示時：selectedの最初の要素を利用 */
  const currentScoringDataId =
    gradingMode === "individual"
      ? selectedScoringDataIds.size > 0
        ? Array.from(selectedScoringDataIds)[0]
        : allScoringData.length > 0
          ? allScoringData[0].id
          : null
      : null

  /** Grid layoutでは不要な階層を削除し、直接表示 */
  return gradingMode === "individual" ? (
    /** 個別表示はフルサイズ表示 */
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
        if (currentScoringDataId) {
          onScoringDataScore(
            [currentScoringDataId],
            statusOrPartialScore,
            partialScore,
          )
        }
      }}
      onTextInputStateChange={onTextInputStateChange}
      currentStudentId={currentStudentId}
      currentUserId={currentUserId}
      questionScores={questionScores}
    />
  ) : (
    /** Grid表示：paddingとスクロールを統合 */
    <AnswerGridView
      allScoringData={allScoringData}
      masterAnswerData={masterAnswerData}
      filteredScoringDataIds={filteredScoringDataIds}
      selectedScoringDataIds={selectedScoringDataIds}
      layoutDirection={layoutDirection}
      onScoringDataSelect={onScoringDataSelect}
      onScoringDataReplace={onScoringDataReplace}
      onScoringDataScore={onScoringDataScore}
      itemsPerRow={itemsPerLine}
      autoScroll={autoScroll}
      showStudentNames={showStudentNames}
      className="p-4"
    />
  )
}
