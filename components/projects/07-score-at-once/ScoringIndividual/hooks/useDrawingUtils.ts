import { useCoordinateTransform } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useCoordinateTransform"
import { useDrawingStyleUtils } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useDrawingStyleUtils"
import { useEditModeUtils } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useEditModeUtils"
import { useHitTestUtils } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useHitTestUtils"

export function useDrawingUtils() {
  // Initialize individual utility modules
  const { drawLineWithStyle } = useDrawingStyleUtils()
  const { hitTestElement, hitTestHandle } = useHitTestUtils()
  const { getLineEditMode, getRectangleEditMode } = useEditModeUtils()
  const { screenToImageCoords, imageToScreenCoords } = useCoordinateTransform()

  return {
    drawLineWithStyle,
    hitTestElement,
    getLineEditMode,
    getRectangleEditMode,
    screenToImageCoords,
    imageToScreenCoords,
    hitTestHandle,
  }
}
