/**
 * 描画要素レンダリングフック
 * - 単一要素の描画
 * - 線種別描画（矢印、波線、ジグザグ等）
 * - アノテーション変換
 */
import { useCallback } from "react"

import { getTextPositionFromAnchor } from "@/app/textbox-on-canvas-v4/utils/canvasUtils"
import type { DrawingElement } from "@/components/exams/07-score-at-once/ScoringIndividual/types/answerIndividualTypes"
import { mmToPixels } from "@/lib/paperSize"
import type { DrawingAnnotationWithQuestionScore } from "@/types/drawingAnnotation.types"

import { renderTextElementV4 } from "../../utils/canvasTextRendererV4"

interface UseDrawingRendererReturn {
  convertAnnotationToDrawingElement: (
    annotation: DrawingAnnotationWithQuestionScore
  ) => DrawingElement
  drawSingleElement: (
    ctx: CanvasRenderingContext2D,
    element: DrawingElement,
    baseImg: HTMLImageElement,
    offsetX: number,
    offsetY: number,
    isSelected: boolean,
    isDragging: boolean,
    showAnchor?: boolean,
    pageSize?: string
  ) => Promise<void>
}

/**
 * 描画要素のレンダリングを管理するフック
 */
export function useDrawingRenderer(): UseDrawingRendererReturn {
  // アノテーションをDrawingElement形式に変換する関数
  const convertAnnotationToDrawingElement = useCallback(
    (annotation: DrawingAnnotationWithQuestionScore): DrawingElement => {
      return {
        id: annotation.id,
        type: annotation.type as DrawingElement["type"],
        x: annotation.x,
        y: annotation.y,
        color: annotation.color,
        strokeWidth: annotation.strokeWidth,
        width: annotation.width,
        height: annotation.height,
        endX: annotation.endX,
        endY: annotation.endY,
        lineStyle: annotation.lineStyle,
        text: annotation.text,
        fontSize: annotation.fontSize,
        textBoxWidth: annotation.textBoxWidth,
        textBoxHeight: annotation.textBoxHeight,
        displayX: annotation.displayX,
        displayY: annotation.displayY,
        anchorDirection: annotation.anchorDirection,
      }
    },
    []
  )

  // 単一要素を描画するヘルパー関数
  const drawSingleElement = useCallback(
    async (
      ctx: CanvasRenderingContext2D,
      element: DrawingElement,
      baseImg: HTMLImageElement,
      offsetX: number,
      offsetY: number,
      isSelected: boolean,
      isDragging: boolean,
      showAnchor: boolean = true,
      pageSize: string = "A4"
    ) => {
      // テキストボックスの場合、表示用座標があればそれを使用
      const displayX =
        element.type === "text" && element.displayX !== undefined
          ? element.displayX
          : element.x
      const displayY =
        element.type === "text" && element.displayY !== undefined
          ? element.displayY
          : element.y

      const currentX = displayX * baseImg.naturalWidth + offsetX
      const currentY = displayY * baseImg.naturalHeight + offsetY

      // mm → canvas pixels 変換
      const strokeWidthPx = mmToPixels(
        element.strokeWidth,
        pageSize,
        baseImg.naturalWidth,
        baseImg.naturalHeight
      )

      const fontSizePx = mmToPixels(
        element.fontSize || 4.0,
        pageSize,
        baseImg.naturalWidth,
        baseImg.naturalHeight
      )

      // ピクセル変換済みの要素コピー（内部描画関数用）
      const pxElement = {
        ...element,
        strokeWidth: strokeWidthPx,
        fontSize: fontSizePx,
      }

      ctx.strokeStyle = element.color
      ctx.fillStyle = element.color
      ctx.lineWidth = strokeWidthPx

      // テキスト要素のドラッグ中は軽量描画（長方形のみ）
      if (isDragging && isSelected && element.type === "text") {
        drawLightweightTextPlaceholder(ctx, pxElement, currentX, currentY)
        return
      }

      // 通常描画
      switch (element.type) {
        case "text":
          await drawTextElement(
            ctx,
            pxElement,
            baseImg,
            isSelected,
            showAnchor,
            currentX,
            currentY
          )
          break
        case "line":
          drawLineElement(
            ctx,
            pxElement,
            baseImg,
            offsetX,
            offsetY,
            currentX,
            currentY
          )
          break
        case "rectangle":
          drawRectangleElement(ctx, pxElement, baseImg, currentX, currentY)
          break
        case "ellipse":
          drawEllipseElement(ctx, pxElement, baseImg, currentX, currentY)
          break
      }
    },
    []
  )

  return {
    convertAnnotationToDrawingElement,
    drawSingleElement,
  }
}

/**
 * 軽量テキストプレースホルダーを描画
 */
function drawLightweightTextPlaceholder(
  ctx: CanvasRenderingContext2D,
  element: DrawingElement,
  currentX: number,
  currentY: number
): void {
  ctx.save()
  ctx.strokeStyle = element.color
  ctx.setLineDash([5, 5])
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.7

  const boundingWidth = element.text
    ? Math.max(element.text.length * (element.fontSize || 16) * 0.6, 50)
    : 50
  const boundingHeight = Math.max((element.fontSize || 16) * 1.2, 20)

  const anchorDir = element.anchorDirection || "top-left"
  const textPos = getTextPositionFromAnchor(
    currentX,
    currentY,
    boundingWidth,
    boundingHeight,
    anchorDir
  )

  ctx.strokeRect(textPos.x, textPos.y, boundingWidth, boundingHeight)

  ctx.font = "12px sans-serif"
  ctx.fillStyle = element.color
  ctx.globalAlpha = 0.8
  const shortText = element.text
    ? element.text.length > 10
      ? element.text.substring(0, 10) + "..."
      : element.text
    : "Text"
  ctx.fillText(shortText, textPos.x + 5, textPos.y + 15)

  ctx.restore()
}

/**
 * テキスト要素を描画
 */
async function drawTextElement(
  ctx: CanvasRenderingContext2D,
  element: DrawingElement,
  baseImg: HTMLImageElement,
  isSelected: boolean,
  showAnchor: boolean,
  currentX: number,
  currentY: number
): Promise<void> {
  if (!element.text) return

  try {
    await renderTextElementV4(
      ctx,
      element,
      baseImg.naturalWidth,
      baseImg.naturalHeight,
      isSelected,
      showAnchor
    )
  } catch (error) {
    console.error("V4テキスト描画エラー:", error)
    // フォールバック: シンプルテキスト描画
    ctx.font = `${element.fontSize || 16}px sans-serif`
    ctx.fillStyle = element.color
    const lines = element.text.split("\n")
    const lineHeight = (element.fontSize || 16) * 1.4
    lines.forEach((line, index) => {
      ctx.fillText(line, currentX, currentY + index * lineHeight)
    })
  }
}

/**
 * 線要素を描画
 */
function drawLineElement(
  ctx: CanvasRenderingContext2D,
  element: DrawingElement,
  baseImg: HTMLImageElement,
  offsetX: number,
  offsetY: number,
  currentX: number,
  currentY: number
): void {
  if (element.endX === undefined || element.endY === undefined) return

  const currentEndX = element.endX * baseImg.naturalWidth + offsetX
  const currentEndY = element.endY * baseImg.naturalHeight + offsetY

  ctx.save()
  ctx.strokeStyle = element.color
  ctx.fillStyle = element.color
  ctx.lineWidth = element.strokeWidth
  ctx.setLineDash([])
  ctx.lineCap = "round"
  ctx.lineJoin = "round"

  const dx = currentEndX - currentX
  const dy = currentEndY - currentY
  const lineLength = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx)
  const arrowSize = Math.max(element.strokeWidth * 5, 12)

  switch (element.lineStyle) {
    case "wave":
      drawWaveLine(
        ctx,
        currentX,
        currentY,
        dx,
        dy,
        lineLength,
        angle,
        element.strokeWidth
      )
      break
    case "zigzag":
      drawZigzagLine(
        ctx,
        currentX,
        currentY,
        dx,
        dy,
        lineLength,
        angle,
        currentEndX,
        currentEndY,
        element.strokeWidth
      )
      break
    case "double":
      drawDoubleLine(
        ctx,
        currentX,
        currentY,
        currentEndX,
        currentEndY,
        angle,
        element.strokeWidth
      )
      break
    case "arrow":
      drawArrowLine(
        ctx,
        currentX,
        currentY,
        currentEndX,
        currentEndY,
        angle,
        arrowSize
      )
      break
    case "both_arrow":
      drawBothArrowLine(
        ctx,
        currentX,
        currentY,
        currentEndX,
        currentEndY,
        angle,
        arrowSize
      )
      break
    default:
      // solid - 通常の直線
      ctx.beginPath()
      ctx.moveTo(currentX, currentY)
      ctx.lineTo(currentEndX, currentEndY)
      ctx.stroke()
      break
  }

  ctx.restore()
}

/**
 * 波線を描画（quadraticCurveTo による滑らかな正弦波）
 */
function drawWaveLine(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  dx: number,
  dy: number,
  lineLength: number,
  angle: number,
  strokeWidth: number
): void {
  const waveAmplitude = strokeWidth * 3
  const waveHalfPeriod = strokeWidth * 6

  // 半周期の数を計算（偶数にして始点と終点が直線上に来るようにする）
  let numHalves = Math.max(Math.round(lineLength / waveHalfPeriod), 2)
  if (numHalves % 2 !== 0) numHalves++

  const perpX = -Math.sin(angle)
  const perpY = Math.cos(angle)

  ctx.beginPath()
  ctx.moveTo(startX, startY)

  for (let i = 0; i < numHalves; i++) {
    const tMid = (i + 0.5) / numHalves
    const tEnd = (i + 1) / numHalves

    // 制御点を振幅の2倍に配置（2次ベジェ曲線の頂点は制御点の半分の高さになるため）
    const controlAmplitude = (i % 2 === 0 ? 1 : -1) * waveAmplitude * 2

    const ctrlX = startX + dx * tMid + perpX * controlAmplitude
    const ctrlY = startY + dy * tMid + perpY * controlAmplitude

    const endPointX = startX + dx * tEnd
    const endPointY = startY + dy * tEnd

    ctx.quadraticCurveTo(ctrlX, ctrlY, endPointX, endPointY)
  }

  ctx.stroke()
}

/**
 * ジグザグ線を描画（全セグメントの傾きが均一）
 *
 * 頂点を半ピッチずらして配置し、始端・終端セグメントの水平距離を
 * 中間セグメントの半分にすることで、全ストロークの傾きを統一する。
 *
 *   start(0) → +A → -A → +A → end(0)
 *     |d/2|  d  |  d  |d/2|
 *
 * 傾き: A/(d/2) = 2A/d （始端・終端）
 *       2A/d           （中間）  → 全て同一
 */
function drawZigzagLine(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  dx: number,
  dy: number,
  lineLength: number,
  angle: number,
  _endX: number,
  _endY: number,
  strokeWidth: number
): void {
  const zigAmplitude = strokeWidth * 3
  const zigPitch = strokeWidth * 5

  // 頂点（山・谷）の数を計算
  const numPeaks = Math.max(Math.round(lineLength / zigPitch), 2)

  const perpX = -Math.sin(angle)
  const perpY = Math.cos(angle)

  ctx.beginPath()
  ctx.moveTo(startX, startY)

  // 各頂点を描画（t = (i + 0.5) / numPeaks で半ピッチずらす）
  for (let i = 0; i < numPeaks; i++) {
    const t = (i + 0.5) / numPeaks
    const baseX = startX + dx * t
    const baseY = startY + dy * t

    const offset = i % 2 === 0 ? zigAmplitude : -zigAmplitude
    ctx.lineTo(baseX + perpX * offset, baseY + perpY * offset)
  }

  // 終点（直線上に戻る）
  ctx.lineTo(startX + dx, startY + dy)
  ctx.stroke()
}

/**
 * 二重線を描画
 */
function drawDoubleLine(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  angle: number,
  strokeWidth: number
): void {
  const offset = strokeWidth
  const perpX = -Math.sin(angle) * offset
  const perpY = Math.cos(angle) * offset

  ctx.beginPath()
  ctx.moveTo(startX + perpX, startY + perpY)
  ctx.lineTo(endX + perpX, endY + perpY)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(startX - perpX, startY - perpY)
  ctx.lineTo(endX - perpX, endY - perpY)
  ctx.stroke()
}

/**
 * 矢印線を描画
 */
function drawArrowLine(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  angle: number,
  arrowSize: number
): void {
  ctx.beginPath()
  ctx.moveTo(startX, startY)
  ctx.lineTo(endX, endY)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(endX, endY)
  ctx.lineTo(
    endX - arrowSize * Math.cos(angle - Math.PI / 6),
    endY - arrowSize * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    endX - arrowSize * Math.cos(angle + Math.PI / 6),
    endY - arrowSize * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()
}

/**
 * 両矢印線を描画
 */
function drawBothArrowLine(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  angle: number,
  arrowSize: number
): void {
  ctx.beginPath()
  ctx.moveTo(startX, startY)
  ctx.lineTo(endX, endY)
  ctx.stroke()

  // 終点の矢印
  ctx.beginPath()
  ctx.moveTo(endX, endY)
  ctx.lineTo(
    endX - arrowSize * Math.cos(angle - Math.PI / 6),
    endY - arrowSize * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    endX - arrowSize * Math.cos(angle + Math.PI / 6),
    endY - arrowSize * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()

  // 始点の矢印（反対方向）
  ctx.beginPath()
  ctx.moveTo(startX, startY)
  ctx.lineTo(
    startX + arrowSize * Math.cos(angle - Math.PI / 6),
    startY + arrowSize * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    startX + arrowSize * Math.cos(angle + Math.PI / 6),
    startY + arrowSize * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()
}

/**
 * 矩形要素を描画
 */
function drawRectangleElement(
  ctx: CanvasRenderingContext2D,
  element: DrawingElement,
  baseImg: HTMLImageElement,
  currentX: number,
  currentY: number
): void {
  if (element.width === undefined || element.height === undefined) return

  const rectWidth = element.width * baseImg.naturalWidth
  const rectHeight = element.height * baseImg.naturalHeight
  ctx.strokeRect(currentX, currentY, rectWidth, rectHeight)
}

/**
 * 楕円要素を描画
 */
function drawEllipseElement(
  ctx: CanvasRenderingContext2D,
  element: DrawingElement,
  baseImg: HTMLImageElement,
  currentX: number,
  currentY: number
): void {
  if (element.width === undefined || element.height === undefined) return

  const rectWidth = element.width * baseImg.naturalWidth
  const rectHeight = element.height * baseImg.naturalHeight

  ctx.beginPath()
  ctx.ellipse(
    currentX + rectWidth / 2,
    currentY + rectHeight / 2,
    Math.abs(rectWidth) / 2,
    Math.abs(rectHeight) / 2,
    0,
    0,
    2 * Math.PI
  )
  ctx.stroke()
}
