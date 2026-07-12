"use client"

import { useDraggable } from "@dnd-kit/core"

import { FilePreviewCell } from "@/components/exams/06-student-answers/student-answer-table/components/FilePreviewCell"
import type { PreviewMode } from "@/components/exams/06-student-answers/student-answer-table/types"
import type { AnswerItem } from "@/components/exams/06-student-answers/types"

interface OrphanAnswerCardProps {
  item: AnswerItem
  // 孤立理由（表示用）。除籍で生徒不明・ページ範囲外など。
  reasonLabel: string
  previewMode: PreviewMode
  getFileColor: (file: AnswerItem) => string
  drawNameRegionCanvas: (
    file: AnswerItem,
    pageNumber: number
  ) => Promise<string | null>
}

/**
 * 孤立答案（表のマスに配置できない答案）をドラッグ可能なカードとして描画する。
 * 方式B の drop 先はマス（droppable）だけなので、これは掴む対象（draggable）専用にする。
 * sortable を使わないことで、掴んでも周囲のマスに reflow が起きない。セルへドロップすると
 * handleDragEnd（方式B）が対象セル座標へ move し、正しい (studentId, pageNumber) を持って
 * マスに表示されるようになる（除籍・ページ範囲外の答案を救済する導線）。
 */
export function OrphanAnswerCard({
  item,
  reasonLabel,
  previewMode,
  getFileColor,
  drawNameRegionCanvas,
}: OrphanAnswerCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      className="flex w-32 cursor-grab flex-col rounded border-2 border-amber-400 bg-white p-1 shadow-sm active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <div className="h-28 w-full">
        <FilePreviewCell
          file={item}
          pageNumber={item.pageNumber}
          previewMode={previewMode}
          isFileDisabled={false}
          nameRegionAvailable={false}
          getFileColor={getFileColor}
          drawNameRegionCanvas={drawNameRegionCanvas}
          imageLoadState="loaded"
        />
      </div>
      <div className="mt-1 truncate text-center text-[10px] text-amber-700">
        {reasonLabel}
      </div>
    </div>
  )
}
