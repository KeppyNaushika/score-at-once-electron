"use client"

import { BarChart3, Eye, User } from "lucide-react"
import { useCallback } from "react"

import { ScoringMethodSection } from "@/components/exams/07-score-at-once/Rubric/ScoringMethodSection"
import type { QuestionProgress } from "@/components/exams/07-score-at-once/ScoringData/types"
import { IndividualModePanel } from "@/components/exams/07-score-at-once/ScoringIndividual/IndividualModePanel"
import ExamProgressCard from "@/components/exams/07-score-at-once/ScoringSidePanel/ExamProgressCard"
import { MasterAnswerControls } from "@/components/exams/07-score-at-once/ScoringSidePanel/MasterAnswerControls"
import QuestionNavigator from "@/components/exams/07-score-at-once/ScoringSidePanel/QuestionNavigator"
import ScoringToolbar from "@/components/exams/07-score-at-once/ScoringSidePanel/ScoringToolbar"
import type {
  AnswerSortOrder,
  LayoutDirection,
  MasterAnswerDisplayMode,
  MasterAnswerKeyBehavior,
  MouseBrushAction,
  ScoringBehavior,
  ScoringExamStudent,
  ScoringOperationMode,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"
import type {
  ClickScoringAction,
  ClickScoringConfig,
} from "@/types/clickScoring.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import { AnnotationBrowserPanel } from "./AnnotationBrowserPanel"
import {
  type AssignmentScope,
  AssignmentScopeNotice,
} from "./AssignmentScopeNotice"
import { DisplaySection } from "./DisplaySection"
import { useSidePanelSections } from "./hooks/useSidePanelSections"
import { ScoreCommentSection } from "./ScoreCommentSection"
import { SidePanelSection } from "./SidePanelSection"

interface ScoringSidePanelProps {
  examId: string
  // Question Navigator props
  cropRegions: QuestionAnswerRegionRow[]
  currentCropRegion?: QuestionAnswerRegionRow | null
  /** いま開いている設問の採点行（覚え書きの節が読む） */
  currentQuestionScores?: readonly QuestionScoreRow[]
  onCropRegionChange: (cropRegion: QuestionAnswerRegionRow | null) => void
  onPrevQuestion: () => void
  onNextQuestion: () => void
  questionProgress: QuestionProgress
  /** AI の判定が未反映の設問（設問一覧の印をオレンジにする） */
  unreflectedAiQuestionIds: ReadonlySet<string>
  /** 採点担当による絞り込みと「すべて表示」 */
  assignmentScope: AssignmentScope
  // Scoring Toolbar props
  selectedAnswersCount: number
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
  onSelectAll?: () => void
  onSelectUnscored?: () => void
  onOpenPartialScoreModal?: () => void
  partialScoreInput: string
  clickScoringConfig?: ClickScoringConfig
  clickScoringDebounceMs?: number
  onClickActionChange?: (
    clickCount: 2 | 3 | 4,
    action: ClickScoringAction
  ) => void
  onClickScoringDebounceMsChange?: (value: number) => void
  // Navigation Controls props
  layoutDirection: LayoutDirection
  visibleAnswersCount: number
  totalAnswersCount: number
  onLayoutDirectionChange: (direction: LayoutDirection) => void
  onGridNavigation: (direction: string) => void
  itemsPerLine: number[]
  onItemsPerLineChange: (value: number[]) => void
  autoScroll: boolean
  onAutoScrollChange: (enabled: boolean) => void
  gradingMode: "grid" | "individual"
  // 一覧表示の並び順
  answerSortOrder: AnswerSortOrder
  onAnswerSortOrderChange: (order: AnswerSortOrder) => void
  isWhitenessReady: boolean
  // 表示領域拡張
  expandMargin?: number
  onExpandMarginChange?: (value: number) => void
  // Individual mode props
  examStudents?: ScoringExamStudent[]
  onStudentChange?: (examStudentId: string) => void
  selectedStudentAnswerImageIds?: Set<string>
  studentAnswerImages?: StudentAnswerImageWithExamStudents[]
  scoringBehavior?: ScoringBehavior
  onScoringBehaviorChange?: (behavior: ScoringBehavior) => void
  // アノテーションブラウザー用追加props
  currentUserId: string
  selectedScoringDataIds?: string[]
  allScoringData?: Array<{ id: string; examStudentId: string }>
  /** キャンバスでアノテーション変更時にブラウザ一覧をリロードするキー */
  annotationRefreshKey?: number
  /** ブラウザの+ボタンでアノテーション追加後のコールバック（キャンバスリロード用） */
  onAnnotationAddedFromBrowser?: () => void
  // 模範解答表示設定
  masterAnswerDisplayMode?: MasterAnswerDisplayMode
  masterAnswerOpacity: number
  masterAnswerKeyBehavior?: MasterAnswerKeyBehavior
  onMasterAnswerDisplayModeChange?: (mode: MasterAnswerDisplayMode) => void
  /** 必須。既定値で握り潰すと、動かしても何も書かないつまみになる */
  onMasterAnswerOpacityChange: (opacity: number) => void
  onMasterAnswerKeyBehaviorChange?: (behavior: MasterAnswerKeyBehavior) => void
  masterAnswerVisible?: boolean
  onToggleMasterAnswer?: () => void
  onMasterAnswerShow?: () => void
  onMasterAnswerHide?: () => void
  // 操作モード関連
  scoringOperationMode?: ScoringOperationMode
  onScoringOperationModeChange?: (mode: ScoringOperationMode) => void
  mouseBrush?: MouseBrushAction
  onMouseBrushChange?: (brush: MouseBrushAction) => void
  visibleUnscoredCount?: number
  hiddenUnscoredCount?: number
  onBatchScoreVisibleUnscored?: (status: MouseBrushAction) => void
}

export function ScoringSidePanel({
  examId,
  cropRegions,
  currentCropRegion,
  currentQuestionScores,
  onCropRegionChange,
  onPrevQuestion,
  onNextQuestion,
  questionProgress,
  unreflectedAiQuestionIds,
  assignmentScope,
  selectedAnswersCount,
  filterSettings,
  onScore,
  onToggleFilter,
  onRefreshFilter,
  onSelectAll,
  onSelectUnscored,
  onOpenPartialScoreModal,
  partialScoreInput,
  clickScoringConfig,
  clickScoringDebounceMs,
  onClickActionChange,
  onClickScoringDebounceMsChange,
  layoutDirection,
  visibleAnswersCount,
  totalAnswersCount,
  onLayoutDirectionChange,
  onGridNavigation,
  itemsPerLine,
  onItemsPerLineChange,
  autoScroll,
  onAutoScrollChange,
  gradingMode,
  answerSortOrder,
  onAnswerSortOrderChange,
  isWhitenessReady,
  expandMargin,
  onExpandMarginChange,
  examStudents,
  onStudentChange,
  selectedStudentAnswerImageIds,
  studentAnswerImages,
  scoringBehavior,
  onScoringBehaviorChange,
  // アノテーションブラウザー用
  currentUserId,
  selectedScoringDataIds,
  allScoringData,
  annotationRefreshKey,
  onAnnotationAddedFromBrowser,
  masterAnswerDisplayMode,
  masterAnswerOpacity,
  masterAnswerKeyBehavior,
  onMasterAnswerDisplayModeChange,
  onMasterAnswerOpacityChange,
  onMasterAnswerKeyBehaviorChange,
  masterAnswerVisible,
  onToggleMasterAnswer,
  onMasterAnswerShow,
  onMasterAnswerHide,
  scoringOperationMode,
  onScoringOperationModeChange,
  mouseBrush,
  onMouseBrushChange,
  visibleUnscoredCount,
  hiddenUnscoredCount,
  onBatchScoreVisibleUnscored,
}: ScoringSidePanelProps) {
  // 閉じているセクションIDを設定へ残す（既定は全展開）
  const { isSectionOpen, toggleSection } = useSidePanelSections()
  // アノテーションの生徒・設問に移動
  const handleNavigateTo = useCallback(
    (examStudentId: string, cropRegionId: string) => {
      const targetCropRegion = cropRegions.find(
        (cropRegion) => cropRegion.id === cropRegionId
      )
      if (targetCropRegion) {
        onCropRegionChange(targetCropRegion)
      }
      if (onStudentChange) {
        onStudentChange(examStudentId)
      }
    },
    [cropRegions, onCropRegionChange, onStudentChange]
  )

  // 現在のexamStudentIdを取得
  const currentExamStudentId = (() => {
    if (!selectedStudentAnswerImageIds || !studentAnswerImages) return undefined
    const selectedId = Array.from(selectedStudentAnswerImageIds)[0]
    const selectedAnswer = studentAnswerImages.find(
      (studentAnswerImage) => studentAnswerImage.id === selectedId
    )
    return selectedAnswer?.examStudentId
  })()

  return (
    <div className="flex h-full w-96 flex-col border-l border-gray-200 bg-white">
      <Tabs defaultValue="scoring" className="flex h-full flex-col">
        <TabsList className="mx-4 mt-2 w-[calc(100%-2rem)] shrink-0">
          <TabsTrigger value="scoring">採点</TabsTrigger>
          <TabsTrigger value="annotations">アノテーション</TabsTrigger>
        </TabsList>

        <TabsContent value="scoring" className="flex-1 overflow-y-auto px-3">
          {/* 進捗 */}
          <SidePanelSection
            icon={BarChart3}
            title="進捗"
            collapsible
            isOpen={isSectionOpen("progress")}
            onToggle={() => toggleSection("progress")}
          >
            <ExamProgressCard questionProgress={questionProgress} />
          </SidePanelSection>

          {/* 採点担当による絞り込み（設問・生徒の両方をここで1度だけ言う） */}
          <AssignmentScopeNotice assignmentScope={assignmentScope} />

          {/* 設問ナビゲーター */}
          <QuestionNavigator
            questionRegions={cropRegions}
            currentCropRegion={currentCropRegion}
            onCropRegionChange={onCropRegionChange}
            onPrevQuestion={onPrevQuestion}
            onNextQuestion={onNextQuestion}
            questionProgress={questionProgress}
            unreflectedAiQuestionIds={unreflectedAiQuestionIds}
            collapsible
            isOpen={isSectionOpen("question")}
            onToggle={() => toggleSection("question")}
          />

          {/* 採点方式（直接採点・減点方式・加点方式） */}
          {currentCropRegion && (
            <ScoringMethodSection
              key={currentCropRegion.id}
              examId={examId}
              cropRegion={currentCropRegion}
              currentUserId={currentUserId}
              isOpen={isSectionOpen("scoringMethod")}
              onToggle={() => toggleSection("scoringMethod")}
            />
          )}

          {/* 表示 */}
          <DisplaySection
            gradingMode={gradingMode}
            selectedAnswersCount={selectedAnswersCount}
            visibleAnswersCount={visibleAnswersCount}
            totalAnswersCount={totalAnswersCount}
            filterSettings={filterSettings}
            onToggleFilter={onToggleFilter}
            layoutDirection={layoutDirection}
            onLayoutDirectionChange={onLayoutDirectionChange}
            itemsPerLine={itemsPerLine}
            onItemsPerLineChange={onItemsPerLineChange}
            expandMargin={expandMargin}
            onExpandMarginChange={onExpandMarginChange}
            answerSortOrder={answerSortOrder}
            onAnswerSortOrderChange={onAnswerSortOrderChange}
            isWhitenessReady={isWhitenessReady}
            isOpen={isSectionOpen("display")}
            onToggle={() => toggleSection("display")}
          />

          {/* 採点ツールバー */}
          <ScoringToolbar
            selectedAnswersCount={selectedAnswersCount}
            onScore={onScore}
            onSelectAll={onSelectAll}
            onSelectUnscored={onSelectUnscored}
            onOpenPartialScoreModal={onOpenPartialScoreModal}
            onRefreshFilter={onRefreshFilter}
            partialScoreInput={partialScoreInput}
            gradingMode={gradingMode}
            clickScoringConfig={clickScoringConfig}
            clickScoringDebounceMs={clickScoringDebounceMs}
            onClickActionChange={onClickActionChange}
            onClickScoringDebounceMsChange={onClickScoringDebounceMsChange}
            autoScroll={autoScroll}
            onAutoScrollChange={onAutoScrollChange}
            onGridNavigation={onGridNavigation}
            isSectionOpen={isSectionOpen}
            onToggleSection={toggleSection}
            scoringOperationMode={scoringOperationMode}
            onScoringOperationModeChange={onScoringOperationModeChange}
            mouseBrush={mouseBrush}
            onMouseBrushChange={onMouseBrushChange}
            visibleUnscoredCount={visibleUnscoredCount}
            hiddenUnscoredCount={hiddenUnscoredCount}
            onBatchScoreVisibleUnscored={onBatchScoreVisibleUnscored}
          />

          {/* 覚え書き（いま選んでいるマスに、その点にした理由を書く） */}
          <ScoreCommentSection
            examId={examId}
            currentCropRegion={currentCropRegion}
            currentQuestionScores={currentQuestionScores}
            currentExamStudentId={currentExamStudentId}
            currentUserId={currentUserId}
            isOpen={isSectionOpen("scoreComment")}
            onToggle={() => toggleSection("scoreComment")}
            onEnsureOpen={() => {
              if (!isSectionOpen("scoreComment")) toggleSection("scoreComment")
            }}
          />

          {/* 個別表示モード時：生徒選択パネル */}
          {gradingMode === "individual" &&
            examStudents &&
            onStudentChange &&
            onScoringBehaviorChange &&
            scoringBehavior && (
              <SidePanelSection
                icon={User}
                title="生徒選択"
                collapsible
                isOpen={isSectionOpen("individualMode")}
                onToggle={() => toggleSection("individualMode")}
              >
                <IndividualModePanel
                  examStudents={examStudents}
                  selectedAnswers={selectedStudentAnswerImageIds}
                  studentAnswerImages={studentAnswerImages}
                  onStudentChange={onStudentChange}
                  scoringBehavior={scoringBehavior}
                  onScoringBehaviorChange={onScoringBehaviorChange}
                />
              </SidePanelSection>
            )}

          {/* 個別表示モード時：模範解答表示設定 */}
          {gradingMode === "individual" &&
            masterAnswerDisplayMode !== undefined &&
            onMasterAnswerDisplayModeChange && (
              <SidePanelSection
                icon={Eye}
                title="模範解答"
                collapsible
                isOpen={isSectionOpen("masterAnswer")}
                onToggle={() => toggleSection("masterAnswer")}
              >
                <MasterAnswerControls
                  displayMode={masterAnswerDisplayMode}
                  opacity={masterAnswerOpacity}
                  keyBehavior={masterAnswerKeyBehavior ?? "toggle"}
                  masterAnswerVisible={masterAnswerVisible ?? false}
                  onDisplayModeChange={onMasterAnswerDisplayModeChange}
                  onOpacityChange={onMasterAnswerOpacityChange}
                  onKeyBehaviorChange={
                    onMasterAnswerKeyBehaviorChange ?? (() => {})
                  }
                  onToggleMasterAnswer={onToggleMasterAnswer ?? (() => {})}
                  onMasterAnswerShow={onMasterAnswerShow}
                  onMasterAnswerHide={onMasterAnswerHide}
                />
              </SidePanelSection>
            )}
        </TabsContent>

        <TabsContent value="annotations" className="flex-1 overflow-y-auto">
          <AnnotationBrowserPanel
            examId={examId}
            currentUserId={currentUserId}
            currentCropRegionId={currentCropRegion?.id}
            currentExamStudentId={currentExamStudentId}
            cropRegions={cropRegions}
            gradingMode={gradingMode}
            annotationRefreshKey={annotationRefreshKey}
            selectedScoringDataIds={selectedScoringDataIds ?? []}
            allScoringData={allScoringData ?? []}
            onAnnotationAddedFromBrowser={onAnnotationAddedFromBrowser}
            onNavigateTo={handleNavigateTo}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
