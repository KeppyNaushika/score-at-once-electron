"use client"

import PartialScoreModal from "@/components/projects/07-score-at-once/components/PartialScoreModal"
import ScoreComparisonModal from "@/components/projects/07-score-at-once/components/ScoreComparisonModal"

interface ScoringModalsProps {
  // Partial Score Modal props
  showPartialScoreModal: boolean
  partialScoreInput: string
  currentQuestion?: any
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
  currentQuestion,
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
        maxPoints={currentQuestion?.points || 0}
        questionLabel={
          currentQuestion?.label || `問${currentQuestion?.orderIndex || 1}`
        }
        onClose={onPartialScoreClose}
        onChange={onPartialScoreChange}
      />

      {/* 採点比較モーダル */}
      <ScoreComparisonModal
        isOpen={showScoreComparison}
        onClose={onScoreComparisonClose}
        studentId={currentAnswerSheet?.studentId || ""}
        cropRegionId={currentQuestion?.id || ""}
        questionLabel={
          currentQuestion?.label || `問${currentQuestion?.orderIndex || 1}`
        }
        maxScore={currentQuestion?.points || 0}
        studentName={
          currentAnswerSheet
            ? `${currentAnswerSheet.student.lastName} ${currentAnswerSheet.student.firstName}`
            : ""
        }
      />
    </div>
  )
}