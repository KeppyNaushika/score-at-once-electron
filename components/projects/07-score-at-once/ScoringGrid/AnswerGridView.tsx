"use client"

import { DragSelectionOverlay } from "@/components/projects/07-score-at-once/ScoringGrid/components/DragSelectionOverlay"
import { GridCell } from "@/components/projects/07-score-at-once/ScoringGrid/components/GridCell"
import { useAutoScroll } from "@/components/projects/07-score-at-once/ScoringGrid/hooks/useAutoScroll"
import { useGridDragSelection } from "@/components/projects/07-score-at-once/ScoringGrid/hooks/useGridDragSelection"
import { useGridKeyboard } from "@/components/projects/07-score-at-once/ScoringGrid/hooks/useGridKeyboard"
import { useGridLayout } from "@/components/projects/07-score-at-once/ScoringGrid/hooks/useGridLayout"
import { useGridNavigation } from "@/components/projects/07-score-at-once/ScoringGrid/hooks/useGridNavigation"
import { useGridSelection } from "@/components/projects/07-score-at-once/ScoringGrid/hooks/useGridSelection"
import { useSelectionBorder } from "@/components/projects/07-score-at-once/ScoringGrid/hooks/useSelectionBorder"
import type {
  LayoutDirection,
  ScoringData,
  ScoringStatus,
} from "@/components/projects/07-score-at-once/types"
import { useRef } from "react"

export interface AnswerGridViewProps {
  // 統一されたデータ引数
  allScoringData: ScoringData[]
  masterAnswerData: any // 模範解答データ
  filteredScoringDataIds: Set<string>
  selectedScoringDataIds: Set<string>
  // Grid表示では設問情報不要

  // 操作関数
  onScoringDataSelect: (id: string, isSelected: boolean) => void
  onScoringDataScore: (id: string | string[], status: ScoringStatus) => void

  // 表示設定
  layoutDirection: LayoutDirection
  itemsPerRow?: number[] // 外部からの1行/列あたり表示件数
  autoScroll?: boolean // 自動スクロール設定
  showStudentNames?: boolean // 生徒名表示設定
  className?: string
}

export default function AnswerGridView({
  allScoringData,
  masterAnswerData,
  filteredScoringDataIds,
  selectedScoringDataIds,
  onScoringDataSelect,
  onScoringDataScore,
  layoutDirection,
  itemsPerRow: externalItemsPerRow,
  autoScroll = true,
  showStudentNames = true,
  className = "",
}: AnswerGridViewProps) {
  // フィルタリングされた採点データを取得（模範解答 + 学生データ）
  const masterAnswers = masterAnswerData ? [{
    ...masterAnswerData,
    isSelected: selectedScoringDataIds.has(masterAnswerData.id),
  }] : []

  const studentAnswers = allScoringData
    .filter((data) => filteredScoringDataIds.has(data.id))
    .map((data) => ({
      ...data,
      isSelected: selectedScoringDataIds.has(data.id),
    }))

  const answers = [...masterAnswers, ...studentAnswers]
  const gridRef = useRef<HTMLDivElement>(null)

  // Custom hooks
  const { itemsPerRow } = useGridNavigation({
    externalItemsPerRow,
  })

  const { dragStart, isDragging, dragCurrent, startDrag, updateDrag, endDrag } =
    useGridSelection()

  const selectionBorderSettings = useSelectionBorder()

  const { effectiveGridSize, sortedAnswers } = useGridLayout({
    answers,
    layoutDirection,
    itemsPerRow,
  })

  const { handleMouseDown, getDragSelectionRect, handleDragSelection } =
    useGridDragSelection({
      gridRef,
      onAnswerSelect: onScoringDataSelect,
      selectedAnswers: selectedScoringDataIds,
      sortedAnswers,
    })

  // Keyboard shortcuts
  useGridKeyboard({
    selectedAnswers: selectedScoringDataIds,
    onAnswerScore: onScoringDataScore,
  })

  // Auto scroll
  useAutoScroll({
    selectedAnswers: selectedScoringDataIds,
    layoutDirection,
    autoScroll,
    gridRef,
  })

  // Mouse event handlers
  const handleMouseMove = (event: React.MouseEvent) => {
    if (dragStart && gridRef.current) {
      const gridRect = gridRef.current.getBoundingClientRect()
      const currentX = event.clientX - gridRect.left
      const currentY = event.clientY - gridRect.top

      const distance = Math.sqrt(
        Math.pow(currentX - dragStart.x, 2) +
          Math.pow(currentY - dragStart.y, 2),
      )
      if (distance > 5 && !isDragging) {
        updateDrag(currentX, currentY)
      }

      // ドラッグ中の現在位置を更新（グリッドコンテナに対する相対座標）
      if (isDragging || distance > 5) {
        updateDrag(currentX, currentY)
      }
    }
  }

  const handleMouseUp = (event: React.MouseEvent) => {
    if (isDragging) {
      // ドラッグ選択を終了
      handleDragSelection(event, dragStart)
    }
    endDrag()
  }

  const onCellMouseDown = (event: React.MouseEvent, answerId: string) => {
    // グリッドコンテナに対する相対座標を保存
    if (gridRef.current) {
      const gridRect = gridRef.current.getBoundingClientRect()
      startDrag(event.clientX - gridRect.left, event.clientY - gridRect.top)
    }

    handleMouseDown(event, answerId)
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${className}`}>
      {/* 答案グリッド */}
      <div
        ref={gridRef}
        className="relative grid min-w-0 gap-2 p-1 select-none"
        style={{
          gridTemplateColumns:
            layoutDirection === "down-right" || layoutDirection === "down-left"
              ? "none" // 列表示: 自動生成される列
              : `repeat(${effectiveGridSize.columns}, 1fr)`,
          gridTemplateRows:
            layoutDirection === "down-right" || layoutDirection === "down-left"
              ? `repeat(${effectiveGridSize.rows}, 1fr)` // 高さのみ指定
              : "none",
          gridAutoRows: "auto",
          gridAutoColumns:
            layoutDirection === "down-right" || layoutDirection === "down-left"
              ? "minmax(200px, max-content)" // 列表示: 最小200px、内容に応じて拡張
              : undefined,
          gridAutoFlow:
            layoutDirection === "down-right" || layoutDirection === "down-left"
              ? "column"
              : "row",
          width: "100%",
          height: "max-content", // 内容に応じた高さ
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
              itemsPerRow={itemsPerRow[0]}
              selectionBorderSettings={selectionBorderSettings}
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
