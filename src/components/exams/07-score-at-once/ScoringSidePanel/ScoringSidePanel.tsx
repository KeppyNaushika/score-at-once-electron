"use client"

import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Circle,
  Clock,
  CopyX,
  Eye,
  Layout,
  Minus,
  User,
  X,
} from "lucide-react"
import { useCallback, useEffect, useRef } from "react"

import { useKeyBindings } from "@/components/exams/07-score-at-once/hooks/useKeyBindings"
import { QuestionProgress } from "@/components/exams/07-score-at-once/ScoringData/types/scoringDataTypes"
import { IndividualModePanel } from "@/components/exams/07-score-at-once/ScoringIndividual/IndividualModePanel"
import ExamProgressCard from "@/components/exams/07-score-at-once/ScoringSidePanel/ExamProgressCard"
import { MasterAnswerControls } from "@/components/exams/07-score-at-once/ScoringSidePanel/MasterAnswerControls"
import NavigationControls from "@/components/exams/07-score-at-once/ScoringSidePanel/NavigationControls"
import QuestionNavigator from "@/components/exams/07-score-at-once/ScoringSidePanel/QuestionNavigator"
import ScoringToolbar from "@/components/exams/07-score-at-once/ScoringSidePanel/ScoringToolbar"
import type {
  CropRegionWithExamPage,
  LayoutDirection,
  MasterAnswerDisplayMode,
  MasterAnswerKeyBehavior,
  MouseBrushAction,
  ScoringOperationMode,
  ScoringStatus,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import type { ScoringStatusType } from "@/lib/scoringStatusColors"

const STATUS_MAP: Record<string, ScoringStatusType> = {
  unscored: "unscored",
  correct: "correct",
  partial: "partial",
  pending: "pending",
  incorrect: "incorrect",
  no_answer: "no_answer",
  double_mark: "double_mark",
}

const FILTER_BUTTONS = [
  { key: "unscored", label: "未採点", icon: Circle },
  { key: "correct", label: "正答", icon: CheckCircle },
  { key: "partial", label: "部分点", icon: AlertTriangle },
  { key: "pending", label: "保留", icon: Clock },
  { key: "incorrect", label: "誤答", icon: X },
  { key: "no_answer", label: "無答", icon: Minus },
  { key: "double_mark", label: "Wマーク", icon: CopyX },
] as const

const GRID_4_3_STYLE = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "0.5rem",
} as const

import { AnnotationBrowserPanel } from "./AnnotationBrowserPanel"
import { useAnnotationBrowser } from "./hooks/useAnnotationBrowser"
import { useSidePanelCollapse } from "./hooks/useSidePanelCollapse"
import { SidePanelSection } from "./SidePanelSection"

interface ScoringSidePanelProps {
  examId: string
  // Question Navigator props
  cropRegions: CropRegionWithExamPage[]
  currentCropRegion?: CropRegionWithExamPage | null
  onCropRegionChange: (cropRegion: CropRegionWithExamPage | null) => void
  onPrevQuestion: () => void
  onNextQuestion: () => void
  questionProgress: QuestionProgress
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
  partialScoreInput: string
  clickScoringConfig?: import("@/components/exams/07-score-at-once/ScoringMain/hooks/useClickScoringConfig").ClickScoringConfig
  clickScoringDebounceMs?: number
  onClickActionChange?: (
    clickCount: 2 | 3 | 4,
    action: import("@/components/exams/07-score-at-once/ScoringMain/hooks/useClickScoringConfig").ClickScoringAction
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
  // 表示領域拡張
  expandMargin?: number
  onExpandMarginChange?: (value: number) => void
  // Individual mode props
  students?: {
    id: string
    studentNumber: string
    lastName: string
    firstName: string
    customOrder: number
  }[]
  onStudentChange?: (studentId: string) => void
  selectedStudentAnswerImageIds?: Set<string>
  studentAnswerImages?: StudentAnswerImageWithExamStudents[]
  scoringBehavior?: "next-student" | "next-question" | "stay"
  onScoringBehaviorChange?: (
    behavior: "next-student" | "next-question" | "stay"
  ) => void
  // アノテーションブラウザー用追加props
  currentUserId?: string
  selectedScoringDataIds?: string[]
  questionScores?: Array<{
    id: string
    studentId: string
    cropRegionId: string
  }>
  allScoringData?: Array<{ id: string; studentId: string }>
  onQuestionScoreCreated?: () => void
  /** キャンバスでアノテーション変更時にブラウザ一覧をリロードするキー */
  annotationRefreshKey?: number
  /** ブラウザの+ボタンでアノテーション追加後のコールバック（キャンバスリロード用） */
  onAnnotationAddedFromBrowser?: () => void
  // 模範解答表示設定
  masterAnswerDisplayMode?: MasterAnswerDisplayMode
  masterAnswerOpacity?: number
  masterAnswerKeyBehavior?: MasterAnswerKeyBehavior
  onMasterAnswerDisplayModeChange?: (mode: MasterAnswerDisplayMode) => void
  onMasterAnswerOpacityChange?: (opacity: number) => void
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
  onCropRegionChange,
  onPrevQuestion,
  onNextQuestion,
  questionProgress,
  selectedAnswersCount,
  filterSettings,
  onScore,
  onToggleFilter,
  onRefreshFilter,
  onSelectAll,
  onSelectUnscored,
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
  expandMargin,
  onExpandMarginChange,
  students,
  onStudentChange,
  selectedStudentAnswerImageIds,
  studentAnswerImages,
  scoringBehavior,
  onScoringBehaviorChange,
  // アノテーションブラウザー用
  currentUserId,
  selectedScoringDataIds,
  questionScores,
  allScoringData,
  onQuestionScoreCreated,
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
  const annotationBrowser = useAnnotationBrowser()
  const { keyBindings } = useKeyBindings()
  const scoringColors = useScoringStatusColors()
  const { isSectionOpen, toggleSection } = useSidePanelCollapse()
  const { loadAnnotations: reloadBrowserAnnotations } = annotationBrowser

  // キャンバスでアノテーション変更時にブラウザ一覧をリロード
  const prevRefreshKeyRef = useRef(annotationRefreshKey)
  useEffect(() => {
    if (
      annotationRefreshKey !== undefined &&
      prevRefreshKeyRef.current !== undefined &&
      annotationRefreshKey !== prevRefreshKeyRef.current
    ) {
      reloadBrowserAnnotations(examId)
    }
    prevRefreshKeyRef.current = annotationRefreshKey
  }, [annotationRefreshKey, reloadBrowserAnnotations, examId])

  // アノテーションの生徒・設問に移動
  const handleNavigateTo = useCallback(
    (studentId: string, cropRegionId: string) => {
      const targetCropRegion = cropRegions.find((cr) => cr.id === cropRegionId)
      if (targetCropRegion) {
        onCropRegionChange(targetCropRegion)
      }
      if (onStudentChange) {
        onStudentChange(studentId)
      }
    },
    [cropRegions, onCropRegionChange, onStudentChange]
  )

  // 現在のstudentIdを取得
  const currentStudentId = (() => {
    if (!selectedStudentAnswerImageIds || !studentAnswerImages) return undefined
    const selectedId = Array.from(selectedStudentAnswerImageIds)[0]
    const selectedAnswer = studentAnswerImages.find((a) => a.id === selectedId)
    return selectedAnswer?.student?.id
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
            <ExamProgressCard examId={examId} />
          </SidePanelSection>

          {/* 設問ナビゲーター */}
          <QuestionNavigator
            questionRegions={cropRegions}
            currentCropRegion={currentCropRegion}
            onCropRegionChange={onCropRegionChange}
            onPrevQuestion={onPrevQuestion}
            onNextQuestion={onNextQuestion}
            questionProgress={questionProgress}
            collapsible
            isOpen={isSectionOpen("question")}
            onToggle={() => toggleSection("question")}
          />

          {/* 表示 */}
          <SidePanelSection
            icon={Layout}
            title="表示"
            collapsible
            isOpen={isSectionOpen("display")}
            onToggle={() => toggleSection("display")}
            rightElement={
              gradingMode === "grid" ? (
                <div className="flex items-center gap-0.5 text-[10px] text-gray-500">
                  {selectedAnswersCount > 0 && (
                    <>
                      <span>選択</span>
                      <span className="font-medium text-blue-600">
                        {selectedAnswersCount}
                      </span>
                      <span className="text-gray-300">|</span>
                    </>
                  )}
                  <span>表示</span>
                  <span className="font-medium">{visibleAnswersCount}</span>
                  <span className="text-gray-300">|</span>
                  <span>全体</span>
                  <span className="font-medium">{totalAnswersCount}</span>
                </div>
              ) : undefined
            }
          >
            <div className="space-y-3">
              {/* 表示フィルター */}
              {gradingMode === "grid" && onToggleFilter && (
                <TooltipProvider delayDuration={300}>
                  <div style={GRID_4_3_STYLE}>
                    {FILTER_BUTTONS.map((button) => {
                      const Icon = button.icon
                      const isActive =
                        filterSettings[
                          button.key as keyof typeof filterSettings
                        ]
                      const statusKey =
                        button.key === "no_answer"
                          ? "NoAnswer"
                          : button.key.charAt(0).toUpperCase() +
                            button.key.slice(1)
                      const commandId = `filter.toggle${statusKey}`
                      const keyBinding = keyBindings[commandId] || "?"
                      const colors = scoringColors[STATUS_MAP[button.key]]
                      return (
                        <Tooltip key={button.key}>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex h-10 w-full min-w-0 items-center gap-1 border-2 px-1"
                              style={
                                isActive
                                  ? {
                                      backgroundColor: colors.bg,
                                      color: colors.text,
                                      borderColor: colors.icon,
                                    }
                                  : {
                                      backgroundColor: "transparent",
                                      color: colors.icon,
                                      borderColor: colors.icon,
                                    }
                              }
                              onClick={() => onToggleFilter(button.key)}
                            >
                              <Icon className="h-3 w-3 shrink-0" />
                              <span className="w-10 shrink-0 text-center text-[10px]">
                                {button.label}
                              </span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-center">
                              <div className="font-medium">
                                {button.label}を{isActive ? "非表示" : "表示"}
                              </div>
                              <div className="mt-1 text-xs text-gray-400">
                                キー:{" "}
                                <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs">
                                  {keyBinding.toUpperCase()}
                                </kbd>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                </TooltipProvider>
              )}

              {/* レイアウト・表示設定 */}
              <NavigationControls
                layoutDirection={layoutDirection}
                onLayoutDirectionChange={onLayoutDirectionChange}
                itemsPerRow={itemsPerLine}
                onItemsPerRowChange={onItemsPerLineChange}
                gradingMode={gradingMode}
                expandMargin={expandMargin}
                onExpandMarginChange={onExpandMarginChange}
              />
            </div>
          </SidePanelSection>

          {/* 採点ツールバー */}
          <ScoringToolbar
            selectedAnswersCount={selectedAnswersCount}
            onScore={onScore}
            onSelectAll={onSelectAll}
            onSelectUnscored={onSelectUnscored}
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

          {/* 個別表示モード時：生徒選択パネル */}
          {gradingMode === "individual" &&
            students &&
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
                  students={students}
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
                  opacity={masterAnswerOpacity ?? 50}
                  keyBehavior={masterAnswerKeyBehavior ?? "toggle"}
                  masterAnswerVisible={masterAnswerVisible ?? false}
                  onDisplayModeChange={onMasterAnswerDisplayModeChange}
                  onOpacityChange={onMasterAnswerOpacityChange ?? (() => {})}
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
            currentStudentId={currentStudentId}
            cropRegions={cropRegions}
            gradingMode={gradingMode}
            displayItems={annotationBrowser.displayItems}
            filters={annotationBrowser.filters}
            isLoading={annotationBrowser.isLoading}
            onFiltersChange={annotationBrowser.setFilters}
            onLoadAnnotations={annotationBrowser.loadAnnotations}
            onToggleFavorite={annotationBrowser.toggleFavorite}
            onAddToTargets={annotationBrowser.addToTargets}
            questionScores={questionScores ?? []}
            selectedScoringDataIds={selectedScoringDataIds ?? []}
            allScoringData={allScoringData ?? []}
            onQuestionScoreCreated={onQuestionScoreCreated}
            onAnnotationAddedFromBrowser={onAnnotationAddedFromBrowser}
            onNavigateTo={handleNavigateTo}
            allAnnotations={annotationBrowser.allAnnotations}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
