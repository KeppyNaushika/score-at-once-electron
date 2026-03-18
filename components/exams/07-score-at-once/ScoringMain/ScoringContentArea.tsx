"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import AnswerGridView from "@/components/exams/07-score-at-once/ScoringGrid/AnswerGridView"
import AnswerIndividualView from "@/components/exams/07-score-at-once/ScoringIndividual/AnswerIndividualView"
import { MasterAnswerView } from "@/components/exams/07-score-at-once/ScoringIndividual/MasterAnswerView"
import type {
  CropRegionWithExamPage,
  GradingMode,
  LayoutDirection,
  MasterAnswerDisplayMode,
  MasterGridItem,
  QuestionScore,
  ScoringData,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"

interface ScoringContentAreaProps {
  gradingMode: GradingMode
  allScoringData: ScoringData[]
  masterAnswerData: MasterGridItem | null
  filteredScoringDataIds: string[]
  selectedScoringDataIds: Set<string>
  currentCropRegion?: CropRegionWithExamPage
  cropRegions?: CropRegionWithExamPage[]
  onScoringDataSelect: (dataId: string, isSelected: boolean) => void
  onScoringDataReplace?: (ids: string[]) => void
  layoutDirection: LayoutDirection
  itemsPerLine: number[]
  autoScroll: boolean
  showStudentNames: boolean
  expandMargin?: number
  studentAnswerImages?: StudentAnswerImageWithExamStudents[]
  onTextInputStateChange?: (showTextInput: boolean) => void
  currentStudentId?: string
  currentUserId?: string
  questionScores?: QuestionScore[]
  onQuestionScoreCreated?: () => void
  onAnnotationChanged?: () => void
  annotationRefreshKey?: number
  gridAnnotationRefreshKey?: number
  masterAnswerDisplayMode?: MasterAnswerDisplayMode
  masterAnswerOpacity?: number
  masterAnswerVisible?: boolean
  allMasterImageUrls?: string[]
  pageSize?: string
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
  masterAnswerDisplayMode = "off",
  masterAnswerOpacity = 50,
  masterAnswerVisible = false,
  allMasterImageUrls,
  pageSize = "A4",
}: ScoringContentAreaProps) {
  const currentScoringDataId =
    gradingMode === "individual"
      ? selectedScoringDataIds.size > 0
        ? Array.from(selectedScoringDataIds)[0]
        : allScoringData.length > 0
          ? allScoringData[0].id
          : null
      : null

  // ===== split用: zoom同期 + 画像サイズ同期 =====
  const [syncedZoom, setSyncedZoom] = useState(1)
  const [answerImageSize, setAnswerImageSize] = useState<{
    width: number
    heights: number[]
  } | null>(null)
  const answerScrollRef = useRef<HTMLDivElement | null>(null)
  const masterScrollRef = useRef<HTMLDivElement>(null)

  const handleZoomChanged = useCallback((zoom: number) => {
    setSyncedZoom(zoom)
  }, [])

  const handleImageSizeChanged = useCallback(
    (size: { width: number; heights: number[] }) => {
      setAnswerImageSize(size)
    },
    []
  )

  const isSplitH = masterAnswerDisplayMode === "split-horizontal"
  const isSplitV = masterAnswerDisplayMode === "split-vertical"
  const isSplit = isSplitH || isSplitV
  const showSplit = masterAnswerVisible && isSplit

  // ===== split用: 双方向スクロール同期（rAFループ） =====
  const rafIdRef = useRef<number>(0)
  const prevAnswerRef = useRef({ left: 0, top: 0 })
  const prevMasterRef = useRef({ left: 0, top: 0 })

  useEffect(() => {
    if (!showSplit) {
      // リセット
      prevAnswerRef.current = { left: 0, top: 0 }
      prevMasterRef.current = { left: 0, top: 0 }
      return
    }

    const sync = () => {
      const answer = answerScrollRef.current
      const master = masterScrollRef.current

      if (answer && master) {
        const aLeft = answer.scrollLeft
        const aTop = answer.scrollTop
        const mLeft = master.scrollLeft
        const mTop = master.scrollTop

        const answerChanged =
          aLeft !== prevAnswerRef.current.left ||
          aTop !== prevAnswerRef.current.top
        const masterChanged =
          mLeft !== prevMasterRef.current.left ||
          mTop !== prevMasterRef.current.top

        if (answerChanged) {
          // 答案側が変化 → 模範解答に同期
          master.scrollLeft = aLeft
          master.scrollTop = aTop
          prevAnswerRef.current = { left: aLeft, top: aTop }
          prevMasterRef.current = { left: aLeft, top: aTop }
        } else if (masterChanged) {
          // 模範解答側が変化 → 答案に同期
          answer.scrollLeft = mLeft
          answer.scrollTop = mTop
          prevAnswerRef.current = { left: mLeft, top: mTop }
          prevMasterRef.current = { left: mLeft, top: mTop }
        }
      }

      rafIdRef.current = requestAnimationFrame(sync)
    }

    rafIdRef.current = requestAnimationFrame(sync)
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [showSplit])

  if (gradingMode !== "individual") {
    return (
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
        pageSize={pageSize}
        className="p-4"
      />
    )
  }

  // 個別表示モード
  const isOverlay = masterAnswerDisplayMode === "overlay"
  const showMaster = masterAnswerVisible && masterAnswerDisplayMode !== "off"

  const answerView = (
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
      // overlay
      masterOverlayImageUrls={isOverlay ? allMasterImageUrls : undefined}
      masterOverlayOpacity={masterAnswerOpacity}
      masterOverlayVisible={isOverlay && showMaster}
      masterDisplayMode={isOverlay ? "overlay" : undefined}
      // zoom・画像サイズ通知は常に有効
      onZoomChanged={handleZoomChanged}
      onImageSizeChanged={handleImageSizeChanged}
      scrollContainerRef={answerScrollRef}
      pageSize={pageSize}
    />
  )

  // 常に同じ構造（remount防止）
  return (
    <div className={`flex h-full w-full ${isSplitV ? "flex-col" : "flex-row"}`}>
      {/* 答案パネル */}
      <div
        className="min-h-0 min-w-0"
        style={{
          flex: showSplit ? "1 1 50%" : "1 1 100%",
          transition: "flex 0.2s ease-in-out",
        }}
      >
        {answerView}
      </div>

      {/* 模範解答パネル（2画面目） */}
      {isSplit && (
        <div
          className="relative min-h-0 min-w-0 overflow-hidden"
          style={{
            flex: showSplit ? "1 1 50%" : "0 0 0%",
            borderLeft: isSplitH && showSplit ? "2px solid #d1d5db" : "none",
            borderTop: isSplitV && showSplit ? "2px solid #d1d5db" : "none",
            transition: "flex 0.2s ease-in-out",
          }}
        >
          {showSplit && (
            <>
              <div className="pointer-events-none absolute top-2 left-2 z-10 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white">
                模範解答
              </div>
              <MasterAnswerView
                ref={masterScrollRef}
                masterImageUrls={allMasterImageUrls}
                zoom={syncedZoom}
                referenceImageSize={answerImageSize ?? undefined}
                answerScrollRef={answerScrollRef}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
