import { UploadToCellModal } from "@/components/projects/06-answer-sheets/answer-sheet-table/components"
import type { UploadModalState } from "@/components/projects/06-answer-sheets/answer-sheet-table/types/local-types"

interface UploadModalWrapperProps {
  uploadModalState: UploadModalState
  onClose: () => void
  onUpload: (file: File, pageNumber?: number) => void
}

export function UploadModalWrapper({
  uploadModalState,
  onClose,
  onUpload,
}: UploadModalWrapperProps) {
  return (
    <UploadToCellModal
      isOpen={uploadModalState.isOpen}
      onClose={onClose}
      onUpload={onUpload}
      studentName={uploadModalState.studentName}
      pageNumber={uploadModalState.pageNumber}
    />
  )
}