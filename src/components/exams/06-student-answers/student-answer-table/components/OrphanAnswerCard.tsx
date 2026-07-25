"use client"

import { useDraggable } from "@dnd-kit/core"

import { FilePreviewCell } from "@/components/exams/06-student-answers/student-answer-table/components/FilePreviewCell"
import type {
  FilePreviewSource,
  PreviewMode,
} from "@/components/exams/06-student-answers/student-answer-table/types"

interface OrphanAnswerCardProps {
  fileId: string
  // 表示ソース（呼び出し側がエンティティから導出）。
  display: FilePreviewSource
  // 孤立理由（表示用）。除籍で生徒不明・列に無い examPageId など。
  reasonLabel: string
  previewMode: PreviewMode
  drawNameRegionCanvas: (
    previewUrl: string | null,
    examPageId: string | null
  ) => Promise<string | null>
}

/**
 * 孤立答案（表のマスに配置できない答案）をドラッグ可能なカードとして描画する。
 * 方式B の drop 先はマス（droppable）だけなので、これは掴む対象（draggable）専用にする。
 * sortable を使わないことで、掴んでも周囲のマスに reflow が起きない。セルへドロップすると
 * handleDragEnd（方式B）が対象セル座標へ move し、正しい (studentId, examPageId) を持って
 * マスに表示されるようになる（除籍・ページ削除の答案を救済する導線）。
 */
export function OrphanAnswerCard({
  fileId,
  display,
  reasonLabel,
  previewMode,
  drawNameRegionCanvas,
}: OrphanAnswerCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: fileId,
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
          previewUrl={display.previewUrl}
          imagePath={display.imagePath}
          altName={display.altName}
          // 孤立答案は列に対応する ExamPage が無いため氏名欄クリップ対象外
          examPageId={null}
          previewMode={previewMode}
          isFileDisabled={false}
          nameRegionAvailable={false}
          drawNameRegionCanvas={drawNameRegionCanvas}
          imageLoadState="loaded"
          correctionStatus={display.correctionStatus}
          correctionError={display.correctionError}
        />
      </div>
      <div className="mt-1 truncate text-center text-[10px] text-amber-700">
        {reasonLabel}
      </div>
    </div>
  )
}
