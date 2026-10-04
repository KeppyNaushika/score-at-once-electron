/**
 * 一覧（グリッド）の切り抜き画像に、手書き注釈を描く
 *
 * 個別表示のキャンバス（ScoringIndividual/utils/drawMainCanvas）と違い、
 * 切り抜いた範囲だけを描くので、座標は切り抜き範囲に対する比で写す。
 */
import { PAPER_DIMENSIONS } from "@/lib/paperSize"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import { renderTextElement } from "../../ScoringIndividual/utils/canvasTextRenderer"

/**
 * Grid表示用アノテーション描画
 * アノテーションの0-1相対座標をクロップ領域→Canvasピクセル座標に変換して描画
 * テキストはrenderTextElementを使用してMathJax対応
 */
export async function drawGridAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: DrawingAnnotation[],
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  imageNaturalWidth: number,
  imageNaturalHeight: number,
  isCancelled: () => boolean,
  pageSize?: string
) {
  // mm→用紙幅比率→canvasピクセルに変換するためのスケール
  // anno.strokeWidth (mm) → anno.strokeWidth / paperWidthMm → × canvasWidth / visibleWidth
  const paper = PAPER_DIMENSIONS[pageSize ?? "A4"] ?? PAPER_DIMENSIONS.A4
  const isLandscape =
    imageNaturalWidth > (imageNaturalHeight ?? imageNaturalWidth)
  const paperWidthMm = isLandscape ? paper.height : paper.width
  const scaleFactor = canvasWidth / (visibleWidth * paperWidthMm)

  for (const anno of annotations) {
    if (isCancelled()) return

    ctx.save()
    ctx.strokeStyle = anno.color
    ctx.fillStyle = anno.color
    ctx.lineWidth = anno.strokeWidth * scaleFactor
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    switch (anno.type) {
      case "text":
        await drawGridText(
          ctx,
          anno,
          visibleX,
          visibleY,
          visibleWidth,
          visibleHeight,
          canvasWidth,
          canvasHeight,
          scaleFactor
        )
        break
      case "line":
        drawGridLine(
          ctx,
          anno,
          visibleX,
          visibleY,
          visibleWidth,
          visibleHeight,
          canvasWidth,
          canvasHeight,
          scaleFactor
        )
        break
      case "rectangle":
        drawGridRectangle(
          ctx,
          anno,
          visibleX,
          visibleY,
          visibleWidth,
          visibleHeight,
          canvasWidth,
          canvasHeight
        )
        break
      case "ellipse":
        drawGridEllipse(
          ctx,
          anno,
          visibleX,
          visibleY,
          visibleWidth,
          visibleHeight,
          canvasWidth,
          canvasHeight
        )
        break
    }

    ctx.restore()
  }
}

/** 0-1相対座標→Canvasピクセル座標に変換 */
function toCanvasX(
  annoX: number,
  visibleX: number,
  visibleWidth: number,
  canvasWidth: number
): number {
  return ((annoX - visibleX) / visibleWidth) * canvasWidth
}

function toCanvasY(
  annoY: number,
  visibleY: number,
  visibleHeight: number,
  canvasHeight: number
): number {
  return ((annoY - visibleY) / visibleHeight) * canvasHeight
}

/**
 * テキスト描画（テキストレンダラー使用: MathJax/SVG対応）
 */
async function drawGridText(
  ctx: CanvasRenderingContext2D,
  anno: DrawingAnnotation,
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  scaleFactor: number
) {
  if (!anno.text) return

  // renderTextElementは element.x * canvasWidth でアンカーピクセル位置を計算するため、
  // Grid Canvas空間での0-1座標へ載せ替えた行を渡す（列は落とさない）
  const element: DrawingAnnotation = {
    ...anno,
    id: `grid-${anno.id}`,
    x: (anno.x - visibleX) / visibleWidth,
    y: (anno.y - visibleY) / visibleHeight,
    fontSize: anno.fontSize * scaleFactor,
  }

  await renderTextElement(
    ctx,
    element,
    canvasWidth,
    canvasHeight,
    false, // isSelected
    false, // showAnchor
    1.0 // opacity
  )
}

/** 線描画（全lineStyle対応） */
function drawGridLine(
  ctx: CanvasRenderingContext2D,
  anno: DrawingAnnotation,
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  scaleFactor: number
) {
  const startX = toCanvasX(anno.x, visibleX, visibleWidth, canvasWidth)
  const startY = toCanvasY(anno.y, visibleY, visibleHeight, canvasHeight)
  const endX = toCanvasX(anno.endX, visibleX, visibleWidth, canvasWidth)
  const endY = toCanvasY(anno.endY, visibleY, visibleHeight, canvasHeight)

  const dx = endX - startX
  const dy = endY - startY
  const lineLength = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx)
  const sw = anno.strokeWidth * scaleFactor
  const arrowSize = sw * 5

  ctx.lineWidth = sw
  ctx.setLineDash([])

  switch (anno.lineStyle) {
    case "wave": {
      // cos波（中央揃え）: 線分の中央が波の頂点
      const waveAmplitude = sw * 1.5
      const wavelength = sw * 10 * 2

      const perpX = -Math.sin(angle)
      const perpY = Math.cos(angle)

      const steps = Math.max(Math.ceil((lineLength / wavelength) * 32), 64)

      ctx.beginPath()
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const pos = t * lineLength
        const theta = (2 * Math.PI * (pos - lineLength / 2)) / wavelength
        const waveOffset = waveAmplitude * Math.cos(theta)

        const x = startX + dx * t + perpX * waveOffset
        const y = startY + dy * t + perpY * waveOffset

        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      break
    }
    case "zigzag": {
      // ジグザグ（cos位相、中央揃え）: 中央が+A頂点
      const zigAmplitude = sw * 1.5
      const zigPitch = sw * 8

      const perpX = -Math.sin(angle)
      const perpY = Math.cos(angle)

      const center = lineLength / 2
      const peaks: { pos: number; amp: number }[] = []

      peaks.push({ pos: center, amp: zigAmplitude })

      for (let i = 1; center + i * zigPitch < lineLength; i++) {
        const amp = (i % 2 === 0 ? 1 : -1) * zigAmplitude
        peaks.push({ pos: center + i * zigPitch, amp })
      }
      for (let i = 1; center - i * zigPitch > 0; i++) {
        const amp = (i % 2 === 0 ? 1 : -1) * zigAmplitude
        peaks.push({ pos: center - i * zigPitch, amp })
      }

      peaks.sort((peakA, peakB) => peakA.pos - peakB.pos)

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
      break
    }
    case "double": {
      const offset = sw
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
      break
    }
    case "arrow": {
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
      break
    }
    case "both_arrow": {
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()
      // 終点矢印
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
      // 始点矢印
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
      break
    }
    default: {
      // solid
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()
      break
    }
  }
}

/** 矩形描画 */
function drawGridRectangle(
  ctx: CanvasRenderingContext2D,
  anno: DrawingAnnotation,
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
  canvasWidth: number,
  canvasHeight: number
) {
  const cx = toCanvasX(anno.x, visibleX, visibleWidth, canvasWidth)
  const cy = toCanvasY(anno.y, visibleY, visibleHeight, canvasHeight)
  const w = (anno.width / visibleWidth) * canvasWidth
  const h = (anno.height / visibleHeight) * canvasHeight
  ctx.strokeRect(cx, cy, w, h)
}

/** 楕円描画 */
function drawGridEllipse(
  ctx: CanvasRenderingContext2D,
  anno: DrawingAnnotation,
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
  canvasWidth: number,
  canvasHeight: number
) {
  const cx = toCanvasX(anno.x, visibleX, visibleWidth, canvasWidth)
  const cy = toCanvasY(anno.y, visibleY, visibleHeight, canvasHeight)
  const w = (anno.width / visibleWidth) * canvasWidth
  const h = (anno.height / visibleHeight) * canvasHeight
  ctx.beginPath()
  ctx.ellipse(
    cx + w / 2,
    cy + h / 2,
    Math.abs(w) / 2,
    Math.abs(h) / 2,
    0,
    0,
    2 * Math.PI
  )
  ctx.stroke()
}
