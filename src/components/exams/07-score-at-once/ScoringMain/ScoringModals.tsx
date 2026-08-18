"use client"

import PartialScoreModal from "@/components/exams/07-score-at-once/ScoringMain/PartialScoreModal"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

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
  currentCropRegion?: QuestionAnswerRegionRow
  onPartialScoreClose: () => void
  onPartialScoreChange: (value: string) => void
  onPartialScoreConfirmPartial?: () => void
  onPartialScoreConfirmPending?: () => void
  onPartialScoreDigit?: (key: string) => void
  onPartialScoreBackspace?: () => void
  keyBindings?: ModalKeyBindings
}

export function ScoringModals({
  showPartialScoreModal,
  partialScoreInput,
  currentCropRegion,
  onPartialScoreClose,
  onPartialScoreChange,
  onPartialScoreConfirmPartial,
  onPartialScoreConfirmPending,
  onPartialScoreDigit,
  onPartialScoreBackspace,
  keyBindings,
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
        onDigit={onPartialScoreDigit}
        onBackspace={onPartialScoreBackspace}
        keyBindings={keyBindings}
      />
    </div>
  )
}
