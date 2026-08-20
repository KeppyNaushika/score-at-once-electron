"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import AnswerGridView from "@/components/exams/07-score-at-once/ScoringGrid/AnswerGridView"
import AnswerIndividualView from "@/components/exams/07-score-at-once/ScoringIndividual/AnswerIndividualView"
import { MasterAnswerView } from "@/components/exams/07-score-at-once/ScoringIndividual/MasterAnswerView"
import type {
  GradingMode,
  LayoutDirection,
  MasterAnswerDisplayMode,
  MasterGridItem,
  MouseBrushAction,
  ScoringData,
  ScoringOperationMode,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

interface ScoringContentAreaProps {
  gradingMode: GradingMode
  allScoringData: ScoringData[]
  masterAnswerData: MasterGridItem | null
  filteredScoringDataIds: string[]
  selectedScoringDataIds: Set<string>
  currentCropRegion?: QuestionAnswerRegionRow
  cropRegions?: QuestionAnswerRegionRow[]
  onScoringDataSelect: (dataId: string, isSelected: boolean) => void
  onScoringDataReplace?: (ids: string[]) => void
  layoutDirection: LayoutDirection
  itemsPerLine: number[]
  autoScroll: boolean
  showStudentNames: boolean
  expandMargin?: number
  studentAnswerImages?: StudentAnswerImageWithExamStudents[]
  currentExamStudentId?: string
  currentUserId?: string
  onAnnotationChanged?: () => void
  annotationRefreshKey?: number
  gridAnnotationRefreshKey?: number
  masterAnswerDisplayMode?: MasterAnswerDisplayMode
  masterAnswerOpacity?: number
  masterAnswerVisible?: boolean
  allMasterImageUrls?: string[]
  pageSize?: string
  onClickScoring?: (answerId: string, clickCount: number) => void
  clickScoringDebounceMs?: number
  scoringOperationMode?: ScoringOperationMode
  mouseBrush?: MouseBrushAction
  onMouseScoring?: (
    answerId: string,
    status: MouseBrushAction,
    isToggle: boolean
  ) => void
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
  currentExamStudentId,
  currentUserId,
  onAnnotationChanged,
  annotationRefreshKey,
  gridAnnotationRefreshKey,
  masterAnswerDisplayMode = "off",
  masterAnswerOpacity = 50,
  masterAnswerVisible = false,
  allMasterImageUrls,
  pageSize = "A4",
  onClickScoring,
  clickScoringDebounceMs,
  scoringOperationMode,
  mouseBrush,
  onMouseScoring,
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

  // ===== split表示の表示前後で答案ビューの中心を維持 =====
  // 模範解答パネルの表示/非表示で答案パネルの幅（左右分割）または高さ（上下分割）が
  // 変化する。サイズ変化に追従して、変化前にビューポート中心にあったコンテンツ点を
  // 変化後も中心に保つ（補正量はサイズ差のみに依存し、ズームに非依存）。
  // CSS transition の各フレームで ResizeObserver が発火するため滑らかに追従し、
  // 非表示に戻す際は対称的な補正で元の中心へ復帰する。
  useEffect(() => {
    if (gradingMode !== "individual") return
    const element = answerScrollRef.current
    if (!element) return

    let prevW = element.clientWidth
    let prevH = element.clientHeight

    const observer = new ResizeObserver(() => {
      const newW = element.clientWidth
      const newH = element.clientHeight
      if (newW === prevW && newH === prevH) return
      // 旧サイズで中心にあったコンテンツ点を、新サイズでも中心に保つ
      element.scrollLeft += (prevW - newW) / 2
      element.scrollTop += (prevH - newH) / 2
      prevW = newW
      prevH = newH
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [gradingMode])

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
        onClickScoring={onClickScoring}
        clickScoringDebounceMs={clickScoringDebounceMs}
        scoringOperationMode={scoringOperationMode}
        mouseBrush={mouseBrush}
        onMouseScoring={onMouseScoring}
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
      currentExamStudentId={currentExamStudentId}
      currentUserId={currentUserId}
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
