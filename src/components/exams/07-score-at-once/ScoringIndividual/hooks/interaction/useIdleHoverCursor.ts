/**
 * @fileoverview 何も掴んでいないときのホバー表示
 * ポインターの下にあるもので、カーソルの形とホバー中の要素（ハンドルを薄く出す）を決める。
 */
import { useCallback } from "react"

import type { useCursor } from "@/components/exams/07-score-at-once/ScoringIndividual/hooks/utils/useCursor"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import {
  findTopmostHandleHit,
  type HandleHitTesters,
} from "../../utils/handleHit"

type CursorControls = ReturnType<typeof useCursor>

interface UseIdleHoverCursorProps extends HandleHitTesters {
  drawingElements: DrawingAnnotation[]
  hitTestElement: (element: DrawingAnnotation, x: number, y: number) => boolean
  setCursor: CursorControls["setCursor"]
  getResizeCursor: CursorControls["getResizeCursor"]
  setHoveredElementId?: (id: string | null) => void
}

/**
 * 選択ツールのホバー判定
 *
 * 優先順は ハンドル → 要素の本体 → 何も無い（範囲選択の十字）。
 */
export function useIdleHoverCursor({
  drawingElements,
  getLineEditMode,
  getResizeHandle,
  hitTestElement,
  setCursor,
  getResizeCursor,
  setHoveredElementId,
}: UseIdleHoverCursorProps) {
  return useCallback(
    (imageCoords: { x: number; y: number }) => {
      const handleHit = findTopmostHandleHit(drawingElements, imageCoords, {
        getLineEditMode,
        getResizeHandle,
      })
      // 前面（配列の後ろ）から見て最初に当たる要素
      const hoveredElement = handleHit
        ? null
        : drawingElements.findLast((element) =>
            hitTestElement(element, imageCoords.x, imageCoords.y)
          )

      if (handleHit) {
        setCursor(
          handleHit.type === "text-anchor"
            ? "move"
            : getResizeCursor(handleHit.element, handleHit.handleName)
        )
      } else if (hoveredElement) {
        setCursor(hoveredElement.type === "text" ? "text" : "move")
      } else {
        setCursor("crosshair")
      }

      if (setHoveredElementId) {
        setHoveredElementId(handleHit?.element.id ?? hoveredElement?.id ?? null)
      }
    },
    [
      drawingElements,
      getLineEditMode,
      getResizeHandle,
      hitTestElement,
      setCursor,
      getResizeCursor,
      setHoveredElementId,
    ]
  )
}
