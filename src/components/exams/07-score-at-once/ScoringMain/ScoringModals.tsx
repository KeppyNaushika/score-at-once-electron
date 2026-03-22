"use client"

import PartialScoreModal from "@/components/exams/07-score-at-once/ScoringMain/PartialScoreModal"
import ScoreComparisonModal from "@/components/exams/07-score-at-once/ScoringMain/ScoreComparisonModal"
import type {
  CropRegionWithExamPage,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"

/** キーバインディングの型 */
interface ModalKeyBindings {
  partialKey?: string
  pendingKey?: string
  cancelKey?: string
}

interface ScoringModalsProps {
  // Partial Score Modal props
  showPartialScoreModal: boolean
  partialScoreInput: string
  currentCropRegion?: CropRegionWithExamPage
  onPartialScoreClose: () => void
  onPartialScoreChange: (value: string) => void
  onPartialScoreConfirmPartial?: () => void
  onPartialScoreConfirmPending?: () => void
  keyBindings?: ModalKeyBindings
  // Score Comparison Modal props
  showScoreComparison: boolean
  onScoreComparisonClose: () => void
  currentAnswerSheet?: StudentAnswerImageWithExamStudents
}

export function ScoringModals({
  showPartialScoreModal,
  partialScoreInput,
  currentCropRegion,
  onPartialScoreClose,
  onPartialScoreChange,
  onPartialScoreConfirmPartial,
  onPartialScoreConfirmPending,
  keyBindings,
  showScoreComparison,
  onScoreComparisonClose,
  currentAnswerSheet,
}: ScoringModalsProps) {
  return (
    <div>
      {/* 部分点入力モーダル */}
      <PartialScoreModal
        isOpen={showPartialScoreModal}
        value={partialScoreInput}
        maxPoints={currentCropRegion?.points || 0}
        questionLabel={
          currentCropRegion?.label || `問${currentCropRegion?.orderIndex || 1}`
        }
        onClose={onPartialScoreClose}
        onChange={onPartialScoreChange}
        onConfirmPartial={onPartialScoreConfirmPartial}
        onConfirmPending={onPartialScoreConfirmPending}
        keyBindings={keyBindings}
      />

      {/* 採点比較モーダル */}
      <ScoreComparisonModal
        isOpen={showScoreComparison}
        onClose={onScoreComparisonClose}
        studentId={currentAnswerSheet?.studentId || ""}
        cropRegionId={currentCropRegion?.id || ""}
        questionLabel={
          currentCropRegion?.label || `問${currentCropRegion?.orderIndex || 1}`
        }
        maxScore={currentCropRegion?.points || 0}
        studentName={
          currentAnswerSheet?.student
            ? `${currentAnswerSheet.student.lastName} ${currentAnswerSheet.student.firstName}`
            : ""
        }
      />
    </div>
  )
}
