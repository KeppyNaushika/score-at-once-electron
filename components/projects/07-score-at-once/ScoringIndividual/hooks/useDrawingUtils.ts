import { useCallback } from "react"
import type {
  DrawingElement,
  LineStyle,
  LineEditMode,
  RectangleEditMode,
} from "../types/answer-individual-types"
import { DRAWING_TOLERANCES } from "../constants/drawing-constants"

export function useDrawingUtils() {
  // 線種描画機能
  const drawLineWithStyle = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      style: LineStyle,
      strokeWidth: number,
    ) => {
      const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
      const angle = Math.atan2(y2 - y1, x2 - x1)

      ctx.save()
      ctx.translate(x1, y1)
      ctx.rotate(angle)

      switch (style) {
        case "solid":
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(length, 0)
          ctx.stroke()
          break
        case "wave":
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.moveTo(0, 0)
          const waveHeight = strokeWidth * 2
          const waveLength = 20
          for (let i = 0; i <= length; i += 2) {
            const y = Math.sin((i / waveLength) * Math.PI * 2) * waveHeight
            ctx.lineTo(i, y)
          }
          ctx.stroke()
          break
        case "zigzag":
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.moveTo(0, 0)
          const zigHeight = strokeWidth * 3
          const zigLength = 15
          for (let i = 0; i <= length; i += zigLength) {
            const y = (i / zigLength) % 2 === 0 ? 0 : zigHeight
            ctx.lineTo(i, y)
          }
          ctx.lineTo(length, 0)
          ctx.stroke()
          break
        case "double":
          ctx.setLineDash([])
          const offset = strokeWidth + 2
          ctx.beginPath()
          ctx.moveTo(0, -offset / 2)
          ctx.lineTo(length, -offset / 2)
          ctx.moveTo(0, offset / 2)
          ctx.lineTo(length, offset / 2)
          ctx.stroke()
          break
      }

      ctx.restore()
    },
    [],
  )

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
            return (
              testX >= element.x &&
              testX <= element.x + element.textBoxWidth &&
              testY >= element.y &&
              testY <= element.y + element.textBoxHeight
            )
          } else {
            // 通常のテキストの場合（点判定）
            return (
              Math.abs(element.x - testX) < tolerance &&
              Math.abs(element.y - testY) < tolerance
            )
          }

        case "line":
          if (element.endX === undefined || element.endY === undefined) {
            return false
          }

          // 線分との距離判定
          const A = testY - element.y
          const B = element.x - testX
          const C =
            (element.endY - element.y) * testX -
            (element.endX - element.x) * testY
          const distance =
            Math.abs(
              A * (element.endX - element.x) +
                B * (element.endY - element.y) +
                C,
            ) /
            Math.sqrt(
              Math.pow(element.endX - element.x, 2) +
                Math.pow(element.endY - element.y, 2),
            )

          return distance < DRAWING_TOLERANCES.lineDistance

        case "rectangle":
          if (element.width === undefined || element.height === undefined) {
            return false
          }

          const left = Math.min(element.x, element.x + element.width)
          const right = Math.max(element.x, element.x + element.width)
          const top = Math.min(element.y, element.y + element.height)
          const bottom = Math.max(element.y, element.y + element.height)

          return (
            testX >= left && testX <= right && testY >= top && testY <= bottom
          )

        default:
          return false
      }
    },
    [],
  )

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

  // 座標変換：スクリーン座標から画像相対座標へ
  const screenToImageCoords = useCallback(
    (
      screenX: number,
      screenY: number,
      displayWidth: number,
      displayHeight: number,
      offsetX: number,
      offsetY: number,
    ): { x: number; y: number } => {
      return {
        x: (screenX - offsetX) / displayWidth,
        y: (screenY - offsetY) / displayHeight,
      }
    },
    [],
  )

  // 座標変換：画像相対座標からスクリーン座標へ
  const imageToScreenCoords = useCallback(
    (
      imageX: number,
      imageY: number,
      displayWidth: number,
      displayHeight: number,
      offsetX: number,
      offsetY: number,
    ): { x: number; y: number } => {
      return {
        x: imageX * displayWidth + offsetX,
        y: imageY * displayHeight + offsetY,
      }
    },
    [],
  )

  return {
    drawLineWithStyle,
    hitTestElement,
    getLineEditMode,
    getRectangleEditMode,
    screenToImageCoords,
    imageToScreenCoords,
  }
}
