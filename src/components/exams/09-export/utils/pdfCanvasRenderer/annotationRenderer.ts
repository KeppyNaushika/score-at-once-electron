/**
 * アノテーション（DrawingAnnotation）のCanvas描画
 *
 * useImageCanvas.ts の drawSingleElement を純粋関数として抽出したもの。
 */

import {
  drawAnnotationEllipse,
  drawAnnotationLine,
  drawAnnotationRectangle,
} from "@/lib/annotationShapeCanvas"
import { mmToPixels } from "@/lib/paperSize"
import { getTextPositionFromAnchor } from "@/lib/textbox-canvas/canvasUtils"
import { convertTextToSvg } from "@/lib/textbox-canvas/textConversionUtils"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import { rasterizeAnnotationSvg } from "./annotationSvgRasterizer"

/**
 * 単一の描画要素をCanvas上に描画
 *
 * useImageCanvas.ts の drawSingleElement を純粋関数として抽出
 *
 * @param ctx - Canvas 2D コンテキスト
 * @param element - 描画要素
 * @param imageWidth - 画像の幅
 * @param imageHeight - 画像の高さ
 * @param offsetX - X座標オフセット
 * @param offsetY - Y座標オフセット
 * @param pageOffset - ページオフセット（複数ページ対応用、デフォルト0）
 *                     UI側で複数ページが縦に結合されたキャンバス上で描画された場合、
 *                     アノテーションのy座標は1ページ目の高さで正規化されるため
 *                     2ページ目以降のアノテーションはy > 1.0になる。
 *                     このオフセットを引くことで正しいページ内座標に変換する。
 */
export async function drawElement(
  ctx: CanvasRenderingContext2D,
  element: DrawingAnnotation,
  imageWidth: number,
  imageHeight: number,
  offsetX: number = 0,
  offsetY: number = 0,
  pageOffset: number = 0,
  pageSize: string = "A4"
): Promise<void> {
  // 座標計算（テキストも含めてelement.x/yを使用 - 一括採点個別表示と同じ）
  // pageOffsetを引くことで、複数ページキャンバスからの座標をページ内座標に変換
  const currentX = element.x * imageWidth + offsetX
  const currentY = (element.y - pageOffset) * imageHeight + offsetY

  // mm → canvas pixels 変換
  const strokeWidthPx = mmToPixels(
    element.strokeWidth,
    pageSize,
    imageWidth,
    imageHeight
  )
  const fontSizePx = mmToPixels(
    element.fontSize,
    pageSize,
    imageWidth,
    imageHeight
  )

  ctx.strokeStyle = element.color
  ctx.fillStyle = element.color
  ctx.lineWidth = strokeWidthPx

  switch (element.type) {
    case "text":
      if (element.text) {
        const anchorDir = element.anchorDirection
        const textColor = element.color

        try {
          const svgElement = await convertTextToSvg(
            element.text,
            imageWidth,
            imageHeight,
            "left",
            "top",
            fontSizePx,
            textColor
          )

          if (svgElement) {
            const rasterized = await rasterizeAnnotationSvg(svgElement)

            const textPosition = getTextPositionFromAnchor(
              currentX,
              currentY,
              rasterized.width,
              rasterized.height,
              anchorDir
            )

            ctx.drawImage(
              rasterized.canvas,
              textPosition.x,
              textPosition.y,
              rasterized.width,
              rasterized.height
            )
          } else {
            throw new Error("Failed to generate SVG")
          }
        } catch (error) {
          console.error("MathJaxテキスト描画エラー:", error)
          // フォールバック: シンプルテキスト描画
          ctx.font = `${fontSizePx}px sans-serif`
          ctx.fillStyle = textColor
          ctx.textBaseline = "top"
          const lines = element.text.split("\n")
          const lineHeight = fontSizePx * 1.4
          lines.forEach((line, index) => {
            ctx.fillText(line, currentX, currentY + index * lineHeight)
          })
        }
      }
      break

    case "line":
      drawAnnotationLine(
        ctx,
        {
          startX: currentX,
          startY: currentY,
          endX: element.endX * imageWidth + offsetX,
          endY: (element.endY - pageOffset) * imageHeight + offsetY,
        },
        element.lineStyle,
        strokeWidthPx
      )
      break

    case "rectangle":
      drawAnnotationRectangle(ctx, {
        x: currentX,
        y: currentY,
        width: element.width * imageWidth,
        height: element.height * imageHeight,
      })
      break

    case "ellipse":
      drawAnnotationEllipse(ctx, {
        x: currentX,
        y: currentY,
        width: element.width * imageWidth,
        height: element.height * imageHeight,
      })
      break
  }
}
