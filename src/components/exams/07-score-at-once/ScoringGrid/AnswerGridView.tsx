"use client"

import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"

import { DragSelectionOverlay } from "@/components/exams/07-score-at-once/ScoringGrid/DragSelectionOverlay"
import { GridCell } from "@/components/exams/07-score-at-once/ScoringGrid/GridCell"
import { useAutoScroll } from "@/components/exams/07-score-at-once/ScoringGrid/hooks/useAutoScroll"
import { useGridAnnotations } from "@/components/exams/07-score-at-once/ScoringGrid/hooks/useGridAnnotations"
import { useGridDragSelection } from "@/components/exams/07-score-at-once/ScoringGrid/hooks/useGridDragSelection"
import { useGridLayout } from "@/components/exams/07-score-at-once/ScoringGrid/hooks/useGridLayout"
import { useGridNavigation } from "@/components/exams/07-score-at-once/ScoringGrid/hooks/useGridNavigation"
import { useGridSelection } from "@/components/exams/07-score-at-once/ScoringGrid/hooks/useGridSelection"
import type {
  LayoutDirection,
  MasterGridItem,
  MouseBrushAction,
  ScoringData,
  ScoringOperationMode,
} from "@/components/exams/07-score-at-once/types"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { parsePreference } from "@/lib/userPreferences"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { userPreferenceQuery } from "@/queries/settings"

interface AnswerGridViewProps {
  /** 統一されたデータ引数 */
  allScoringData: ScoringData[]
  /** Grid表示用の模範解答データ */
  masterAnswerData: MasterGridItem | null
  filteredScoringDataIds: string[]
  selectedScoringDataIds: Set<string>

  /** 操作関数 */
  onScoringDataSelect: (id: string, isSelected: boolean) => void
  onScoringDataReplace?: (ids: string[]) => void

  /** 表示設定 */
  layoutDirection: LayoutDirection
  /** 外部からの1行/列あたり表示件数 */
  itemsPerRow?: number[]
  /** 自動スクロール設定 */
  autoScroll?: boolean
  /** 生徒名表示設定 */
  showStudentNames?: boolean
  /** 表示領域拡張率 (0-50%) */
  expandMargin?: number
  /** アノテーション描画用: 現在の設問 */
  currentCropRegion?: QuestionAnswerRegionRow
  /** アノテーション描画用: 現在のユーザーID */
  currentUserId: string
  /** アノテーションリフレッシュキー（変更検知用） */
  annotationRefreshKey?: number
  /** 用紙サイズ（mm→px変換基準） */
  pageSize?: string
  /** クリック採点コールバック（answerId, 最終クリック回数） */
  onClickScoring?: (answerId: string, clickCount: number) => void
  /** クリック採点のデバウンス時間（ms） */
  clickScoringDebounceMs?: number
  /** 採点操作モード */
  scoringOperationMode?: ScoringOperationMode
  /** マウスモード時のブラシ */
  mouseBrush?: MouseBrushAction
  /** マウスモード時のクリック採点コールバック */
  onMouseScoring?: (
    answerId: string,
    status: MouseBrushAction,
    isToggle: boolean
  ) => void
  className?: string
}

export default function AnswerGridView({
  allScoringData,
  masterAnswerData,
  filteredScoringDataIds,
  selectedScoringDataIds,
  onScoringDataSelect,
  onScoringDataReplace,
  layoutDirection,
  itemsPerRow: externalItemsPerRow,
  autoScroll = true,
  showStudentNames = true,
  expandMargin,
  currentCropRegion,
  currentUserId,
  annotationRefreshKey,
  pageSize,
  onClickScoring,
  clickScoringDebounceMs = 300,
  scoringOperationMode,
  mouseBrush,
  onMouseScoring,
  className = "",
}: AnswerGridViewProps) {
  const isMouseMode = scoringOperationMode === "mouse"
  /** フィルタリングされた採点データ（模範解答 + 学生データ） */
  const masterAnswers = masterAnswerData
    ? [
        {
          ...masterAnswerData,
          isSelected: selectedScoringDataIds.has(masterAnswerData.id),
        },
      ]
    : []

  const studentAnswers = allScoringData
    .filter((scoringData) => filteredScoringDataIds.includes(scoringData.id))
    .map((scoringData) => ({
      ...scoringData,
      isSelected: selectedScoringDataIds.has(scoringData.id),
    }))

  const answers = [...masterAnswers, ...studentAnswers]

  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  /** コンテナサイズ監視（列レイアウト用） */
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      setContainerSize({
        width: container.offsetWidth,
        height: container.offsetHeight,
      })
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  /** 主要なカスタムフック */
  const { itemsPerRow } = useGridNavigation({
    externalItemsPerRow,
  })

  const { dragStart, isDragging, dragCurrent, startDrag, updateDrag, endDrag } =
    useGridSelection()

  const currentUser = useCurrentUser()
  const { data: storedSelectionBorderColor } = useQuery(
    userPreferenceQuery(currentUser.id, "selectionBorderColor")
  )
  const selectionBorderColor =
    parsePreference(
      "selectionBorderColor",
      storedSelectionBorderColor ?? null
    ) ?? "#F97316"
  const scoringColors = useScoringStatusColors()

  /** アノテーション取得（設問ごとに全学生分を一括取得） */
  const { annotationsByExamStudent } = useGridAnnotations({
    cropRegionId: currentCropRegion?.id,
    currentUserId,
    refreshKey: annotationRefreshKey,
  })

  const { effectiveGridSize, sortedAnswers } = useGridLayout({
    answers,
    layoutDirection,
    itemsPerRow,
  })

  const { handleMouseDown, getDragSelectionRect, handleDragSelection } =
    useGridDragSelection({
      gridRef,
      onAnswerSelect: onScoringDataSelect,
      onReplaceSelection: onScoringDataReplace,
      selectedAnswers: selectedScoringDataIds,
      sortedAnswers,
    })

  /** 自動スクロール制御 */
  useAutoScroll({
    selectedAnswers: selectedScoringDataIds,
    autoScroll,
    containerRef,
  })

  /** ドラッグ中のマウス移動ハンドラー */
  const handleMouseMove = (event: React.MouseEvent) => {
    if (isMouseMode) return // マウスモードではドラッグ無効
    if (dragStart && gridRef.current) {
      const gridRect = gridRef.current.getBoundingClientRect()
      const currentX = event.clientX - gridRect.left
      const currentY = event.clientY - gridRect.top

      const distance = Math.sqrt(
        Math.pow(currentX - dragStart.x, 2) +
          Math.pow(currentY - dragStart.y, 2)
      )
      if (distance > 5 && !isDragging) {
        updateDrag(currentX, currentY)
      }

      if (isDragging || distance > 5) {
        updateDrag(currentX, currentY)
      }
    }
  }

  const handleMouseUp = (event: React.MouseEvent) => {
    if (isMouseMode) return // マウスモードではドラッグ無効
    if (isDragging) {
      handleDragSelection(event, dragStart)
    }
    endDrag()
  }

  /** 生徒答案ごとの独立デバウンスタイマー管理 */
  const clickTimersRef = useRef<
    Map<string, { timerId: ReturnType<typeof setTimeout>; clickCount: number }>
  >(new Map())

  const onCellMouseDown = useCallback(
    (event: React.MouseEvent, answerId: string) => {
      if (answerId.startsWith("master-")) return

      // マウスモード: シングルクリックでブラシ適用（トグル付き）、ダブル以上はonClickScoring
      if (isMouseMode) {
        // 「選択」ブラシ: 採点せず即時に選択トグル
        if (mouseBrush === "select") {
          if (event.detail === 1) {
            onScoringDataSelect(answerId, !selectedScoringDataIds.has(answerId))
          }
          return
        }

        if (event.detail >= 2 && onClickScoring) {
          const timers = clickTimersRef.current
          const existing = timers.get(answerId)
          if (existing) {
            clearTimeout(existing.timerId)
          }
          const clickCount = Math.max(event.detail, existing?.clickCount ?? 0)
          const timerId = setTimeout(() => {
            timers.delete(answerId)
            onClickScoring(answerId, clickCount)
          }, clickScoringDebounceMs)
          timers.set(answerId, { timerId, clickCount })
          return
        }

        // シングルクリック: ブラシで採点
        if (event.detail === 1 && onMouseScoring && mouseBrush) {
          // デバウンスでダブルクリックを待つ
          const timers = clickTimersRef.current
          const existing = timers.get(answerId)
          if (existing) {
            clearTimeout(existing.timerId)
          }
          const timerId = setTimeout(() => {
            timers.delete(answerId)
            onMouseScoring(answerId, mouseBrush, true)
          }, clickScoringDebounceMs)
          timers.set(answerId, { timerId, clickCount: 1 })
        }
        return
      }

      // キーボードモード: 従来動作
      if (event.detail >= 2 && onClickScoring) {
        const timers = clickTimersRef.current
        const existing = timers.get(answerId)

        if (existing) {
          clearTimeout(existing.timerId)
        }

        const clickCount = Math.max(event.detail, existing?.clickCount ?? 0)

        const timerId = setTimeout(() => {
          timers.delete(answerId)
          onClickScoring(answerId, clickCount)
        }, clickScoringDebounceMs)

        timers.set(answerId, { timerId, clickCount })
        return
      }

      // シングルクリック: ドラッグ開始 + 通常の選択処理
      if (gridRef.current) {
        const gridRect = gridRef.current.getBoundingClientRect()
        startDrag(event.clientX - gridRect.left, event.clientY - gridRect.top)
      }
      handleMouseDown(event, answerId)
    },
    [
      isMouseMode,
      startDrag,
      handleMouseDown,
      onClickScoring,
      clickScoringDebounceMs,
      onMouseScoring,
      mouseBrush,
      onScoringDataSelect,
      selectedScoringDataIds,
    ]
  )

  const isColumnLayout =
    layoutDirection === "down-right" || layoutDirection === "down-left"

  /** 列レイアウト時のセル高さを計算（トップダウンで明示的に計算） */
  const OUTER_PADDING = 16 // p-4 = 16px（外側コンテナのpadding）
  const GRID_GAP = 8 // gap-2 = 8px
  const GRID_PADDING = 4 // p-1 = 4px
  const calculatedCellHeight = isColumnLayout
    ? (containerSize.height -
        OUTER_PADDING * 2 -
        GRID_PADDING * 2 -
        GRID_GAP * (itemsPerRow[0] - 1)) /
      itemsPerRow[0]
    : 0

  return (
    <div
      ref={containerRef}
      className={`h-full min-h-0 ${isColumnLayout ? "overflow-x-auto overflow-y-hidden" : "overflow-y-auto"} ${className}`}
    >
      {/* 答案グリッド */}
      <div
        ref={gridRef}
        className="relative grid min-w-0 gap-2 p-1 select-none"
        style={{
          gridTemplateColumns: isColumnLayout
            ? "none"
            : `repeat(${effectiveGridSize.columns}, 1fr)`,
          gridTemplateRows: isColumnLayout
            ? `repeat(${effectiveGridSize.rows}, 1fr)`
            : "none",
          gridAutoRows: "auto",
          gridAutoColumns: isColumnLayout
            ? "minmax(200px, max-content)"
            : undefined,
          gridAutoFlow: isColumnLayout ? "column" : "row",
          direction: layoutDirection === "down-left" ? "rtl" : "ltr",
          width: isColumnLayout ? "max-content" : "100%",
          // 列レイアウト時は高さを100%にして、行ごとに均等分割
          height: isColumnLayout ? "100%" : "max-content",
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {sortedAnswers().map((answer) => {
          if (!answer) return <div key="empty" />

          const isSelected = selectedScoringDataIds.has(answer.id)

          return (
            <GridCell
              key={answer.id}
              answer={answer}
              isSelected={isSelected}
              showStudentNames={showStudentNames}
              layoutDirection={layoutDirection}
              calculatedCellHeight={calculatedCellHeight}
              selectionBorderColor={selectionBorderColor}
              scoringColors={scoringColors}
              expandMargin={expandMargin}
              annotations={annotationsByExamStudent.get(answer.examStudentId)}
              pageSize={pageSize}
              onMouseDown={onCellMouseDown}
            />
          )
        })}

        {/* ドラッグ選択範囲の可視化 */}
        {isDragging &&
          dragStart &&
          dragCurrent &&
          (() => {
            const rect = getDragSelectionRect(dragStart, dragCurrent)
            if (!rect) return null
            return <DragSelectionOverlay rect={rect} />
          })()}
      </div>
    </div>
  )
}
