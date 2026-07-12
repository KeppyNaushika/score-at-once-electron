import { DragOverlay } from "@dnd-kit/core"

import { FilePreviewCell } from "@/components/exams/06-student-answers/student-answer-table/components/FilePreviewCell"
import type { PreviewMode } from "@/components/exams/06-student-answers/student-answer-table/types"
import type { AnswerItem } from "@/components/exams/06-student-answers/types"

interface TableDragOverlayProps {
  activeFile: AnswerItem | null
  previewMode: PreviewMode
  // ドラッグ中の答案が属するページに氏名欄があるか（name-only プレビュー用）
  nameRegionAvailable?: boolean
  getFileColor: (file: AnswerItem) => string
  drawNameRegionCanvas: (
    file: AnswerItem,
    pageNumber: number
  ) => Promise<string | null>
}

export function TableDragOverlay({
  activeFile,
  previewMode,
  nameRegionAvailable = false,
  getFileColor,
  drawNameRegionCanvas,
}: TableDragOverlayProps) {
  return (
    <DragOverlay dropAnimation={null}>
      {activeFile ? (
        <div className="h-32 w-32 scale-110 rotate-3 transform rounded border-2 border-blue-400 bg-white shadow-2xl">
          <FilePreviewCell
            file={activeFile}
            // ドラッグ中の答案の実ページで描画する（氏名欄クリップも正しいページ基準になる）
            pageNumber={activeFile.pageNumber}
            previewMode={previewMode}
            isFileDisabled={false}
            nameRegionAvailable={nameRegionAvailable}
            getFileColor={getFileColor}
            drawNameRegionCanvas={drawNameRegionCanvas}
            imageLoadState="loaded"
          />
        </div>
      ) : null}
    </DragOverlay>
  )
}
