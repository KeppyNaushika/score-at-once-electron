"use client"

import { useEffect, useRef } from "react"

import { QuestionProgress } from "@/components/exams/07-score-at-once/ScoringData/types/scoringDataTypes"
import { IndividualModePanel } from "@/components/exams/07-score-at-once/ScoringIndividual/IndividualModePanel"
import ExamProgressCard from "@/components/exams/07-score-at-once/ScoringSidePanel/ExamProgressCard"
import NavigationControls from "@/components/exams/07-score-at-once/ScoringSidePanel/NavigationControls"
import QuestionNavigator from "@/components/exams/07-score-at-once/ScoringSidePanel/QuestionNavigator"
import ScoringToolbar from "@/components/exams/07-score-at-once/ScoringSidePanel/ScoringToolbar"
import type {
  CropRegionWithExamPage,
  LayoutDirection,
  ScoringStatus,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { AnnotationBrowserPanel } from "./AnnotationBrowserPanel"
import { useAnnotationBrowser } from "./hooks/useAnnotationBrowser"

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
  partialScoreInput: string
  // Navigation Controls props
  layoutDirection: LayoutDirection
  visibleAnswersCount: number
  totalAnswersCount: number
  onLayoutDirectionChange: (direction: LayoutDirection) => void
  onGridNavigation: (direction: string) => void
  onRefreshView: () => void
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
  partialScoreInput,
  layoutDirection,
  visibleAnswersCount,
  totalAnswersCount,
  onLayoutDirectionChange,
  onGridNavigation,
  onRefreshView,
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
}: ScoringSidePanelProps) {
  const annotationBrowser = useAnnotationBrowser()
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

        <TabsContent value="scoring" className="flex-1 overflow-y-auto px-4">
          {/* 設問ナビゲーター */}
          <QuestionNavigator
            questionRegions={cropRegions}
            currentCropRegion={currentCropRegion}
            onCropRegionChange={onCropRegionChange}
            onPrevQuestion={onPrevQuestion}
            onNextQuestion={onNextQuestion}
            questionProgress={questionProgress}
          />

          <Separator />

          {/* 採点ツールバー */}
          <ScoringToolbar
            selectedAnswersCount={selectedAnswersCount}
            currentCropRegion={currentCropRegion}
            filterSettings={filterSettings}
            onScore={onScore}
            onToggleFilter={onToggleFilter}
            onRefreshFilter={onRefreshFilter}
            partialScoreInput={partialScoreInput}
            gradingMode={gradingMode}
          />

          {/* 個別表示モード時：生徒選択パネル */}
          {gradingMode === "individual" &&
            students &&
            onStudentChange &&
            onScoringBehaviorChange &&
            scoringBehavior && (
              <>
                <Separator />
                <IndividualModePanel
                  students={students}
                  selectedAnswers={selectedStudentAnswerImageIds}
                  studentAnswerImages={studentAnswerImages}
                  onStudentChange={onStudentChange}
                  scoringBehavior={scoringBehavior}
                  onScoringBehaviorChange={onScoringBehaviorChange}
                />
              </>
            )}

          <Separator />

          {/* ナビゲーション制御 */}
          <NavigationControls
            layoutDirection={layoutDirection}
            selectedAnswersCount={selectedAnswersCount}
            visibleAnswersCount={visibleAnswersCount}
            totalAnswersCount={totalAnswersCount}
            onLayoutDirectionChange={onLayoutDirectionChange}
            onGridNavigation={onGridNavigation}
            onRefreshView={onRefreshView}
            itemsPerRow={itemsPerLine}
            onItemsPerRowChange={onItemsPerLineChange}
            autoScroll={autoScroll}
            onAutoScrollChange={onAutoScrollChange}
            gradingMode={gradingMode}
            expandMargin={expandMargin}
            onExpandMarginChange={onExpandMarginChange}
          />

          <Separator />

          {/* 試験進捗 */}
          <div className="py-3">
            <ExamProgressCard examId={examId} />
          </div>
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
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
