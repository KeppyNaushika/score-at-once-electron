"use client"

import { useRef } from "react"
import { GridCell } from "@/components/projects/07-score-at-once/components/answer-grid/components/GridCell"
import { DragSelectionOverlay } from "@/components/projects/07-score-at-once/components/answer-grid/components/DragSelectionOverlay"
import { useGridNavigation } from "@/components/projects/07-score-at-once/components/answer-grid/hooks/useGridNavigation"
import { useGridSelection } from "@/components/projects/07-score-at-once/components/answer-grid/hooks/useGridSelection"
import { useSelectionBorder } from "@/components/projects/07-score-at-once/components/answer-grid/hooks/useSelectionBorder"
import { useGridLayout } from "@/components/projects/07-score-at-once/components/answer-grid/hooks/useGridLayout"
import { useGridKeyboard } from "@/components/projects/07-score-at-once/components/answer-grid/hooks/useGridKeyboard"
import { useAutoScroll } from "@/components/projects/07-score-at-once/components/answer-grid/hooks/useAutoScroll"
import { useGridDragSelection } from "@/components/projects/07-score-at-once/components/answer-grid/hooks/useGridDragSelection"
import type { AnswerGridViewProps } from "@/components/projects/07-score-at-once/components/answer-grid/types/grid-types"

export default function AnswerGridContainer({
  answers,
  layoutDirection,
  gridSize,
  onAnswerSelect,
  onAnswerScore,
  selectedAnswers,
  className = "",
  onEffectiveColumnsChange,
  itemsPerRow: externalItemsPerRow,
  autoScroll = true,
  showStudentNames = true,
}: AnswerGridViewProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  // Custom hooks
  const { itemsPerRow } = useGridNavigation({
    onEffectiveColumnsChange,
    externalItemsPerRow,
  })

  const {
    dragStart,
    isDragging,
    dragCurrent,
    startDrag,
    updateDrag,
    endDrag,
  } = useGridSelection()

  const selectionBorderSettings = useSelectionBorder()

  const { effectiveGridSize, sortedAnswers } = useGridLayout({
    answers,
    layoutDirection,
    itemsPerRow,
    gridSize,
  })

  const { handleMouseDown, getDragSelectionRect, handleDragSelection } =
    useGridDragSelection({
      gridRef,
      onAnswerSelect,
      selectedAnswers,
      sortedAnswers,
    })

  // Keyboard shortcuts
  useGridKeyboard({ selectedAnswers, onAnswerScore })

  // Auto scroll
  useAutoScroll({
    selectedAnswers,
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
      startDrag(
        event.clientX - gridRect.left,
        event.clientY - gridRect.top,
      )
    }

    handleMouseDown(event, answerId)
  }

  return (
    <div className={`flex h-full min-w-0 flex-col ${className}`}>
      {/* 答案グリッド */}
      <div
        ref={gridRef}
        className={`relative grid min-w-0 gap-2 p-1 select-none ${
          layoutDirection === "down-right" || layoutDirection === "down-left"
            ? "h-full"
            : "h-auto"
        }`}
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
          width:
            layoutDirection === "down-right" || layoutDirection === "down-left"
              ? "auto" // 列表示: 内容に応じて幅を拡張
              : "100%", // 行表示: 幅100%
          maxWidth:
            layoutDirection === "down-right" || layoutDirection === "down-left"
              ? "none" // 列表示: 最大幅制限なし
              : "100%", // 行表示: 最大幅100%
          overflowX:
            layoutDirection === "down-right" || layoutDirection === "down-left"
              ? "auto"
              : "hidden",
          overflowY:
            layoutDirection === "right-down" || layoutDirection === "left-down"
              ? "auto"
              : "hidden",
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {sortedAnswers().map((answer) => {
          if (!answer) return <div key="empty" />

          const isSelected = selectedAnswers.has(answer.id)

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