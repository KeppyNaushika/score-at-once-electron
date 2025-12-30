import { UploadToCellModal } from "@/components/projects/06-student-answers/student-answer-table/components/UploadToCellModal"
import type { UploadModalState } from "@/components/projects/06-student-answers/student-answer-table/types/localTypes"

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
