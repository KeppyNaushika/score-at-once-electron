import { DragOverlay } from "@dnd-kit/core"

import { FilePreviewCell } from "@/components/exams/06-student-answers/student-answer-table/components/FilePreviewCell"
import type {
  FilePreviewSource,
  PreviewMode,
} from "@/components/exams/06-student-answers/student-answer-table/types"

interface TableDragOverlayProps {
  // ドラッグ中の答案の表示ソース（呼び出し側がエンティティ／未保存項目から導出）
  activeDisplay: FilePreviewSource | null
  // ドラッグ中の答案が置かれているページ番号（氏名欄クリップ用。列 ExamPage から導出、無ければ 0）
  pageNumber: number
  previewMode: PreviewMode
  // ドラッグ中の答案が属するページに氏名欄があるか（name-only プレビュー用）
  nameRegionAvailable?: boolean
  drawNameRegionCanvas: (
    previewUrl: string | null,
    pageNumber: number
  ) => Promise<string | null>
}

export function TableDragOverlay({
  activeDisplay,
  pageNumber,
  previewMode,
  nameRegionAvailable = false,
  drawNameRegionCanvas,
}: TableDragOverlayProps) {
  return (
    <DragOverlay dropAnimation={null}>
      {activeDisplay ? (
        <div className="h-32 w-32 scale-110 rotate-3 transform rounded border-2 border-blue-400 bg-white shadow-2xl">
          <FilePreviewCell
            previewUrl={activeDisplay.previewUrl}
            imagePath={activeDisplay.imagePath}
            altName={activeDisplay.altName}
            pageNumber={pageNumber}
            previewMode={previewMode}
            isFileDisabled={false}
            nameRegionAvailable={nameRegionAvailable}
            drawNameRegionCanvas={drawNameRegionCanvas}
            imageLoadState="loaded"
            correctionStatus={activeDisplay.correctionStatus}
            correctionError={activeDisplay.correctionError}
          />
        </div>
      ) : null}
    </DragOverlay>
  )
}
