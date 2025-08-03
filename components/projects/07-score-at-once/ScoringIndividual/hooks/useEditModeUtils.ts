import { useCallback } from "react"
import type { 
  DrawingElement, 
  LineEditMode, 
  RectangleEditMode 
} from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import { DRAWING_TOLERANCES } from "@/components/projects/07-score-at-once/ScoringIndividual/constants/drawing-constants"

export function useEditModeUtils() {
  // 線の編集モード判定（開始点、終了点、移動）
  const getLineEditMode = useCallback(
    (element: DrawingElement, testX: number, testY: number): LineEditMode => {
      if (
        element.type !== "line" ||
        element.endX === undefined ||
        element.endY === undefined
      ) {
        return null
      }

      const tolerance = DRAWING_TOLERANCES.hitTest

      // 開始点判定
      if (
        Math.abs(element.x - testX) < tolerance &&
        Math.abs(element.y - testY) < tolerance
      ) {
        return "start"
      }

      // 終了点判定
      if (
        Math.abs(element.endX - testX) < tolerance &&
        Math.abs(element.endY - testY) < tolerance
      ) {
        return "end"
      }

      // 線分との距離判定（移動モード）
      const A = testY - element.y
      const B = element.x - testX
      const C =
        (element.endY - element.y) * testX - (element.endX - element.x) * testY
      const distance =
        Math.abs(
          A * (element.endX - element.x) + B * (element.endY - element.y) + C,
        ) /
        Math.sqrt(
          Math.pow(element.endX - element.x, 2) +
            Math.pow(element.endY - element.y, 2),
        )

      if (distance < DRAWING_TOLERANCES.lineDistance) {
        return "move"
      }

      return null
    },
    [],
  )

  // 矩形の編集モード判定（角・辺でのリサイズ、内部での移動）
  const getRectangleEditMode = useCallback(
    (
      element: DrawingElement,
      testX: number,
      testY: number,
    ): RectangleEditMode => {
      if (
        element.type !== "rectangle" ||
        element.width === undefined ||
        element.height === undefined
      ) {
        return null
      }

      const tolerance = DRAWING_TOLERANCES.rectangleEdge
      const left = Math.min(element.x, element.x + element.width)
      const right = Math.max(element.x, element.x + element.width)
      const top = Math.min(element.y, element.y + element.height)
      const bottom = Math.max(element.y, element.y + element.height)

      // 角や辺の近くかチェック（リサイズモード）
      const nearLeft = Math.abs(testX - left) < tolerance
      const nearRight = Math.abs(testX - right) < tolerance
      const nearTop = Math.abs(testY - top) < tolerance
      const nearBottom = Math.abs(testY - bottom) < tolerance

      if (
        (nearLeft || nearRight || nearTop || nearBottom) &&
        testX >= left - tolerance &&
        testX <= right + tolerance &&
        testY >= top - tolerance &&
        testY <= bottom + tolerance
      ) {
        return "resize"
      }

      // 内部かチェック（移動モード）
      if (testX > left && testX < right && testY > top && testY < bottom) {
        return "move"
      }

      return null
    },
    [],
  )

  return {
    getLineEditMode,
    getRectangleEditMode,
  }
}