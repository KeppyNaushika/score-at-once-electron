import { DRAWING_TOLERANCES } from "@/components/projects/07-score-at-once/ScoringIndividual/constants/drawing-constants"
import type { DrawingElement } from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import { useCallback } from "react"

export function useHitTestUtils() {
  // 要素のヒットテスト
  const hitTestElement = useCallback(
    (element: DrawingElement, testX: number, testY: number): boolean => {
      const tolerance = DRAWING_TOLERANCES.hitTest

      switch (element.type) {
        case "text":
          if (
            element.textBoxWidth !== undefined &&
            element.textBoxHeight !== undefined
          ) {
            // テキストボックスの場合
            const textBoxResult =
              testX >= element.x &&
              testX <= element.x + element.textBoxWidth &&
              testY >= element.y &&
              testY <= element.y + element.textBoxHeight
            return textBoxResult
          } else {
            // 通常のテキストの場合（点判定）
            const textResult =
              Math.abs(element.x - testX) < tolerance &&
              Math.abs(element.y - testY) < tolerance
            return textResult
          }

        case "line":
          if (element.endX === undefined || element.endY === undefined) {
            return false
          }

          // 線を囲む長方形で判定（より直感的）
          const lineLeft = Math.min(element.x, element.endX) - tolerance
          const lineRight = Math.max(element.x, element.endX) + tolerance
          const lineTop = Math.min(element.y, element.endY) - tolerance
          const lineBottom = Math.max(element.y, element.endY) + tolerance

          const lineResult =
            testX >= lineLeft &&
            testX <= lineRight &&
            testY >= lineTop &&
            testY <= lineBottom
          return lineResult

        case "rectangle":
          if (element.width === undefined || element.height === undefined) {
            return false
          }

          const left = Math.min(element.x, element.x + element.width)
          const right = Math.max(element.x, element.x + element.width)
          const top = Math.min(element.y, element.y + element.height)
          const bottom = Math.max(element.y, element.y + element.height)

          const rectangleResult =
            testX >= left && testX <= right && testY >= top && testY <= bottom
          return rectangleResult

        default:
          return false
      }
    },
    [],
  )

  // ハンドルの当たり判定
  const hitTestHandle = useCallback(
    (element: DrawingElement, testX: number, testY: number): string | null => {
      const handleTolerance = 0.02 // ハンドルの当たり判定範囲（正規化座標）

      switch (element.type) {
        case "line":
          if (element.endX === undefined || element.endY === undefined) {
            return null
          }

          // 開始点ハンドル
          if (
            Math.abs(element.x - testX) < handleTolerance &&
            Math.abs(element.y - testY) < handleTolerance
          ) {
            return "start"
          }

          // 終了点ハンドル
          if (
            Math.abs(element.endX - testX) < handleTolerance &&
            Math.abs(element.endY - testY) < handleTolerance
          ) {
            return "end"
          }
          break

        case "rectangle":
        case "text":
          const width = element.width || element.textBoxWidth || 0
          const height = element.height || element.textBoxHeight || 0

          if (width === 0 || height === 0) return null

          // 4つの角のハンドル
          const corners = [
            { x: element.x, y: element.y, handle: "top-left" },
            { x: element.x + width, y: element.y, handle: "top-right" },
            { x: element.x, y: element.y + height, handle: "bottom-left" },
            {
              x: element.x + width,
              y: element.y + height,
              handle: "bottom-right",
            },
          ]

          for (const corner of corners) {
            if (
              Math.abs(corner.x - testX) < handleTolerance &&
              Math.abs(corner.y - testY) < handleTolerance
            ) {
              return corner.handle
            }
          }
          break
      }

      return null
    },
    [],
  )

  return {
    hitTestElement,
    hitTestHandle,
  }
}
