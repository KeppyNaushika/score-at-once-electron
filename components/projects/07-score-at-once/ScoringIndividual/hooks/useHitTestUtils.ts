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

          // 点と線分の距離を計算する正確な判定（useEditModeUtilsから移植）
          const lineLength = Math.sqrt(
            Math.pow(element.endX - element.x, 2) +
            Math.pow(element.endY - element.y, 2)
          )
          
          // 線の長さが0の場合は点として扱う
          if (lineLength === 0) {
            const lineResult =
              Math.abs(element.x - testX) < tolerance &&
              Math.abs(element.y - testY) < tolerance
            return lineResult
          }

          // 点から線分への最短距離を計算
          const A = testY - element.y
          const B = element.x - testX
          const C = (element.endY - element.y) * testX - (element.endX - element.x) * testY
          const distance = Math.abs(
            A * (element.endX - element.x) + B * (element.endY - element.y) + C
          ) / lineLength

          // 線分の範囲内にあるかもチェック
          const dotProduct = 
            ((testX - element.x) * (element.endX - element.x) +
             (testY - element.y) * (element.endY - element.y)) / (lineLength * lineLength)
          
          const isWithinSegment = dotProduct >= 0 && dotProduct <= 1
          
          // 線分の範囲外の場合は端点までの距離を計算
          let finalDistance = distance
          if (!isWithinSegment) {
            const distToStart = Math.sqrt(
              Math.pow(testX - element.x, 2) + Math.pow(testY - element.y, 2)
            )
            const distToEnd = Math.sqrt(
              Math.pow(testX - element.endX, 2) + Math.pow(testY - element.endY, 2)
            )
            finalDistance = Math.min(distToStart, distToEnd)
          }

          const lineResult = finalDistance < DRAWING_TOLERANCES.lineDistance
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

        case "ellipse":
          if (element.width === undefined || element.height === undefined) {
            return false
          }

          // 楕円の中心座標を計算
          const centerX = element.x + element.width / 2
          const centerY = element.y + element.height / 2
          
          // 楕円の半径（幅と高さの半分）
          const radiusX = Math.abs(element.width) / 2
          const radiusY = Math.abs(element.height) / 2
          
          // 楕円の方程式: (x-cx)²/rx² + (y-cy)²/ry² <= 1
          const normalizedX = (testX - centerX) / radiusX
          const normalizedY = (testY - centerY) / radiusY
          const ellipseResult = (normalizedX * normalizedX + normalizedY * normalizedY) <= 1
          
          return ellipseResult

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
        case "ellipse":
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
