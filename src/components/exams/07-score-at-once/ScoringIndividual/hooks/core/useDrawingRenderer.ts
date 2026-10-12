/**
 * 描画要素レンダリングフック
 * - 単一要素の描画（線・矩形・楕円）。形そのものは `@/lib/annotationShapeCanvas` が描き、
 *   ここは注釈の 0-1 座標・mm の線幅をキャンバスのピクセルへ写すだけ
 *
 * テキストは扱わない。呼び出し側（utils/drawMainCanvas）は両方のループで
 * `type === "text"` を飛ばし、テキストだけを別のパスで `renderTextElement` に
 * 描かせている（数式のレンダリングが非同期で、描画順も他と分ける必要があるため）。
 */
import { useCallback } from "react"

import {
  drawAnnotationEllipse,
  drawAnnotationLine,
  drawAnnotationRectangle,
} from "@/lib/annotationShapeCanvas"
import { mmToPixels } from "@/lib/paperSize"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

interface UseDrawingRendererReturn {
  drawSingleElement: (
    ctx: CanvasRenderingContext2D,
    element: DrawingAnnotation,
    baseImg: HTMLImageElement,
    offsetX: number,
    offsetY: number,
    pageSize?: string
  ) => void
}

/**
 * 描画要素のレンダリングを管理するフック
 */
export function useDrawingRenderer(): UseDrawingRendererReturn {
  // 単一要素を描画するヘルパー関数
  const drawSingleElement = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      element: DrawingAnnotation,
      baseImg: HTMLImageElement,
      offsetX: number,
      offsetY: number,
      pageSize: string = "A4"
    ) => {
      const currentX = element.x * baseImg.naturalWidth + offsetX
      const currentY = element.y * baseImg.naturalHeight + offsetY

      // mm → canvas pixels 変換
      const strokeWidthPx = mmToPixels(
        element.strokeWidth,
        pageSize,
        baseImg.naturalWidth,
        baseImg.naturalHeight
      )

      ctx.strokeStyle = element.color
      ctx.fillStyle = element.color
      ctx.lineWidth = strokeWidthPx

      switch (element.type) {
        case "line":
          drawAnnotationLine(
            ctx,
            {
              startX: currentX,
              startY: currentY,
              endX: element.endX * baseImg.naturalWidth + offsetX,
              endY: element.endY * baseImg.naturalHeight + offsetY,
            },
            element.lineStyle,
            strokeWidthPx
          )
          break
        case "rectangle":
          drawAnnotationRectangle(ctx, {
            x: currentX,
            y: currentY,
            width: element.width * baseImg.naturalWidth,
            height: element.height * baseImg.naturalHeight,
          })
          break
        case "ellipse":
          drawAnnotationEllipse(ctx, {
            x: currentX,
            y: currentY,
            width: element.width * baseImg.naturalWidth,
            height: element.height * baseImg.naturalHeight,
          })
          break
        case "text":
          // 呼び出し側が飛ばしている（このフックの冒頭を参照）
          break
      }
    },
    []
  )

  return {
    drawSingleElement,
  }
}
