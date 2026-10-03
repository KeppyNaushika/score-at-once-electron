import { useEffect } from "react"

import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import type {
  GradingMode,
  ScoringOperationMode,
} from "@/components/exams/07-score-at-once/types"

import { useScoringShortcuts } from "./useScoringShortcuts"

interface UseScoringScreenBindingsOptions {
  gradingMode: GradingMode
  hasSelectedAnswers: boolean
  sidePanelVisible: boolean
  partialScoreModalOpen: boolean
  scoringOperationMode: ScoringOperationMode
  currentCropRegionId: string | null
  selectableCropRegions: readonly { id: string }[]
  setCurrentCropRegionId: (cropRegionId: string | null) => void
  shortcuts: Parameters<typeof useScoringShortcuts>[0]
}

/**
 * 採点画面を、キー操作の文脈（`useContextValue`）とショートカットへつなぐ。
 * あわせて、担当が外れて選べなくなった設問に留まらせない。
 */
export function useScoringScreenBindings({
  gradingMode,
  hasSelectedAnswers,
  sidePanelVisible,
  partialScoreModalOpen,
  scoringOperationMode,
  currentCropRegionId,
  selectableCropRegions,
  setCurrentCropRegionId,
  shortcuts,
}: UseScoringScreenBindingsOptions) {
  useContextValue("gradingMode", gradingMode)
  useContextValue("hasSelectedAnswers", hasSelectedAnswers)
  useContextValue("sidePanelVisible", sidePanelVisible)
  useContextValue("partialScoreModalOpen", partialScoreModalOpen)
  // 確定は「8. 採点確定」の段へ出たので、ここで殺すのは部分点モーダルだけ。
  // 別ページなら 07 のキー操作はそもそも載っていない（ガードが要らなくなった）
  useContextValue("modalOpen", partialScoreModalOpen)
  useContextValue("scoringOperationMode", scoringOperationMode)

  /**
   * 担当が外れて選べなくなった設問に留まらせない。
   * null に戻すと useScoringEffects が担当集合の先頭を選び直す。
   */
  useEffect(() => {
    if (!currentCropRegionId || selectableCropRegions.length === 0) return
    const isSelectable = selectableCropRegions.some(
      (cropRegion) => cropRegion.id === currentCropRegionId
    )
    if (!isSelectable) {
      setCurrentCropRegionId(null)
    }
  }, [currentCropRegionId, selectableCropRegions, setCurrentCropRegionId])

  useScoringShortcuts(shortcuts)
}
