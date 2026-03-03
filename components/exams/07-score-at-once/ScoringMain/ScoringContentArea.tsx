"use client"

import AnswerGridView from "@/components/exams/07-score-at-once/ScoringGrid/AnswerGridView"
import AnswerIndividualView from "@/components/exams/07-score-at-once/ScoringIndividual/AnswerIndividualView"
import type {
  CropRegionWithExamPage,
  GradingMode,
  LayoutDirection,
  MasterGridItem,
  QuestionScore,
  ScoringData,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"

interface ScoringContentAreaProps {
  gradingMode: GradingMode

  /** 採点データ管理（両View共通） */
  allScoringData: ScoringData[]
  masterAnswerData: MasterGridItem | null
  filteredScoringDataIds: string[]
  selectedScoringDataIds: Set<string>

  /** 設問情報（Individual表示のみ必要） */
  currentCropRegion?: CropRegionWithExamPage
  /** 全採点領域（Individual表示の全設問マーク描画用） */
  cropRegions?: CropRegionWithExamPage[]

  /** 操作関数（両View共通） */
  onScoringDataSelect: (dataId: string, isSelected: boolean) => void
  onScoringDataReplace?: (ids: string[]) => void

  /** GridView設定 */
  layoutDirection: LayoutDirection
  itemsPerLine: number[]
  autoScroll: boolean
  showStudentNames: boolean
  expandMargin?: number

  /** IndividualView設定 */
  studentAnswerImages?: StudentAnswerImageWithExamStudents[]

  /** テキスト入力状態変更のコールバック（ショートカット制御用） */
  onTextInputStateChange?: (showTextInput: boolean) => void

  /** QuestionScore自動作成用のコンテキスト情報 */
  currentStudentId?: string
  currentUserId?: string

  /** アノテーション用: QuestionScore配列 */
  questionScores?: QuestionScore[]

  /** QuestionScore自動作成後のコールバック（リストの更新用） */
  onQuestionScoreCreated?: () => void

  /** アノテーション変更通知（キャンバス→ブラウザパネル連携用） */
  onAnnotationChanged?: () => void
  /** 外部からのアノテーション追加後のリフレッシュキー（ブラウザパネル→キャンバス連携用） */
  annotationRefreshKey?: number
  /** Grid表示用アノテーションリフレッシュキー */
  gridAnnotationRefreshKey?: number
}

export function ScoringContentArea({
  gradingMode,
  allScoringData,
  masterAnswerData,
  filteredScoringDataIds,
  selectedScoringDataIds,
  currentCropRegion,
  cropRegions,
  onScoringDataSelect,
  onScoringDataReplace,
  layoutDirection,
  itemsPerLine,
  autoScroll,
  showStudentNames,
  expandMargin,
  studentAnswerImages,
  onTextInputStateChange,
  currentStudentId,
  currentUserId,
  questionScores,
  onQuestionScoreCreated,
  onAnnotationChanged,
  annotationRefreshKey,
  gridAnnotationRefreshKey,
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
      cropRegions={cropRegions}
      studentAnswerImages={studentAnswerImages}
      onTextInputStateChange={onTextInputStateChange}
      currentStudentId={currentStudentId}
      currentUserId={currentUserId}
      questionScores={questionScores}
      onQuestionScoreCreated={onQuestionScoreCreated}
      onAnnotationChanged={onAnnotationChanged}
      annotationRefreshKey={annotationRefreshKey}
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
      itemsPerRow={itemsPerLine}
      autoScroll={autoScroll}
      showStudentNames={showStudentNames}
      expandMargin={expandMargin}
      currentCropRegion={currentCropRegion}
      currentUserId={currentUserId}
      annotationRefreshKey={gridAnnotationRefreshKey}
      className="p-4"
    />
  )
}
