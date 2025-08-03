"use client"

import PartialScoreModal from "@/components/projects/07-score-at-once/ScoringMain/PartialScoreModal"
import ScoreComparisonModal from "@/components/projects/07-score-at-once/ScoringMain/ScoreComparisonModal"

interface ScoringModalsProps {
  // Partial Score Modal props
  showPartialScoreModal: boolean
  partialScoreInput: string
  currentCropRegion?: any
  onPartialScoreClose: () => void
  onPartialScoreChange: (value: string) => void
  // Score Comparison Modal props
  showScoreComparison: boolean
  onScoreComparisonClose: () => void
  currentAnswerSheet?: any
}

export function ScoringModals({
  showPartialScoreModal,
  partialScoreInput,
  currentCropRegion,
  onPartialScoreClose,
  onPartialScoreChange,
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
          currentAnswerSheet
            ? `${currentAnswerSheet.student.lastName} ${currentAnswerSheet.student.firstName}`
            : ""
        }
      />
    </div>
  )
}
