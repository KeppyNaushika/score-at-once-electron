/**
 * OMR マーカー（用紙の四隅の黒い四角）の座標計算。
 */

import type { GlobalSettings } from "@/types/answerSheetDefinition.types"
import type { ComputedOMRMarker } from "@/types/answerSheetLayout.types"

/** OMRマーカー（四隅）の座標を計算する */
export function computeOMRMarkers(
  settings: GlobalSettings,
  paper: { width: number; height: number }
): ComputedOMRMarker[] {
  if (!settings.omrMarkers.enabled) return []
  const { sizeMm, offsetMm } = settings.omrMarkers
  return [
    { x: offsetMm, y: offsetMm, size: sizeMm },
    { x: paper.width - offsetMm - sizeMm, y: offsetMm, size: sizeMm },
    { x: offsetMm, y: paper.height - offsetMm - sizeMm, size: sizeMm },
    {
      x: paper.width - offsetMm - sizeMm,
      y: paper.height - offsetMm - sizeMm,
      size: sizeMm,
    },
  ]
}
