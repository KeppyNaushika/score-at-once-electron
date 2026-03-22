/**
 * 描画要素レンダリングフック
 * - 単一要素の描画
 * - 線種別描画（矢印、波線、ジグザグ等）
 * - アノテーション変換
 */
import { useCallback } from "react"

import type { DrawingElement } from "@/components/exams/07-score-at-once/ScoringIndividual/types/answerIndividualTypes"
import { mmToPixels } from "@/lib/paperSize"
import { getTextPositionFromAnchor } from "@/lib/textbox-canvas/canvasUtils"
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
  const arrowSize = element.strokeWidth * 5

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
 * 波線を描画（cos波、中央揃え）
 *
 * 線分の中央が波の頂点になるcos波を描画する。
 * 始点・終点は波の途中で切れてもよい（偶数制約なし）。
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
  const waveAmplitude = strokeWidth * 1.5
  const wavelength = strokeWidth * 10 * 2

  const perpX = -Math.sin(angle)
  const perpY = Math.cos(angle)

  const steps = Math.max(Math.ceil((lineLength / wavelength) * 32), 64)

  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const pos = t * lineLength
    const theta = (2 * Math.PI * (pos - lineLength / 2)) / wavelength
    const offset = waveAmplitude * Math.cos(theta)

    const x = startX + dx * t + perpX * offset
    const y = startY + dy * t + perpY * offset

    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

/**
 * ジグザグ線を描画（cos位相、中央揃え）
 *
 * 線分の中央が頂点(+A)になるよう、中央から左右対称に頂点を配置する。
 * 始点・終点は直線上で、端の頂点が途中で切れることはないが、
 * 端のセグメント長は中央部分と異なる場合がある。
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
  const zigAmplitude = strokeWidth * 1.5
  const zigPitch = strokeWidth * 8

  const perpX = -Math.sin(angle)
  const perpY = Math.cos(angle)

  // 中央基準で頂点を配置（中央が+A、左右にzigPitch間隔で交互）
  const center = lineLength / 2
  const peaks: { pos: number; amp: number }[] = []

  // 中央の頂点
  peaks.push({ pos: center, amp: zigAmplitude })

  // 中央から左右に展開
  for (let i = 1; center + i * zigPitch < lineLength; i++) {
    const amp = (i % 2 === 0 ? 1 : -1) * zigAmplitude
    peaks.push({ pos: center + i * zigPitch, amp })
  }
  for (let i = 1; center - i * zigPitch > 0; i++) {
    const amp = (i % 2 === 0 ? 1 : -1) * zigAmplitude
    peaks.push({ pos: center - i * zigPitch, amp })
  }

  // 位置順にソート
  peaks.sort((a, b) => a.pos - b.pos)

  ctx.beginPath()
  ctx.moveTo(startX, startY)

  for (const peak of peaks) {
    const t = peak.pos / lineLength
    const baseX = startX + dx * t
    const baseY = startY + dy * t
    ctx.lineTo(baseX + perpX * peak.amp, baseY + perpY * peak.amp)
  }

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
