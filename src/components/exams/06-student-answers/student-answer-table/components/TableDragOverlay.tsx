import { DragOverlay } from "@dnd-kit/core"

import { FilePreviewCell } from "@/components/exams/06-student-answers/student-answer-table/components/FilePreviewCell"
import type { PreviewMode } from "@/components/exams/06-student-answers/student-answer-table/types"
import type { UnifiedFile } from "@/components/exams/06-student-answers/types"

interface TableDragOverlayProps {
  activeFile: UnifiedFile | null
  previewMode: PreviewMode
  getFileColor: (file: UnifiedFile) => string
  drawNameRegionCanvas: (
    file: UnifiedFile,
    pageNumber: number
  ) => Promise<string | null>
}

export function TableDragOverlay({
  activeFile,
  previewMode,
  getFileColor,
  drawNameRegionCanvas,
}: TableDragOverlayProps) {
  return (
    <DragOverlay dropAnimation={null}>
      {activeFile ? (
        <div className="h-32 w-32 scale-110 rotate-3 transform rounded border-2 border-blue-400 bg-white shadow-2xl">
          <FilePreviewCell
            file={activeFile}
            pageNumber={1}
            previewMode={previewMode}
            isFileDisabled={false}
            nameRegionAvailable={false}
            getFileColor={getFileColor}
            drawNameRegionCanvas={drawNameRegionCanvas}
            imageLoadState="loaded"
          />
        </div>
      ) : null}
    </DragOverlay>
  )
}
