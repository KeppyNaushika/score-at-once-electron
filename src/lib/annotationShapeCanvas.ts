/**
 * 手書き注釈（DrawingAnnotation）の線・矩形・楕円を Canvas 2D に描く
 *
 * 一括採点の個別表示（ScoringIndividual）・一覧の切り抜き（ScoringMain）・PDF 出力
 * （09-export）の3経路が同じ形を描くための1か所。経路ごとに書き写していた頃は、
 * 個別表示と PDF で描画がずれる不具合が繰り返し起きた。
 *
 * 座標・線幅はすべて**キャンバスのピクセル**で受け取る。注釈の 0-1 座標や mm の線幅を
 * ピクセルへ写すのは、座標系の異なる各呼び出し側の仕事として残す。
 *
 * 色（strokeStyle / fillStyle）と矩形・楕円の線幅は呼び出し側が ctx に設定しておくこと。
 * 角の形（lineCap / lineJoin）はここで決めるので、どの経路でも同じ見た目になる。
 */
import { assertNever } from "@/lib/assertNever"
import type { LineStyle } from "@/types/drawingAnnotation.types"

/** キャンバスのピクセルで表した線分 */
export interface CanvasLineSegment {
  startX: number
  startY: number
  endX: number
  endY: number
}

/** キャンバスのピクセルで表した矩形（楕円はこれに内接する） */
export interface CanvasRectangle {
  x: number
  y: number
  width: number
  height: number
}

/** 矢じりの開き（片側 30°） */
const ARROW_HEAD_HALF_ANGLE = Math.PI / 6

/**
 * 線の注釈を線種どおりに描く
 *
 * ctx の状態は save / restore で囲むので、線幅・破線・lineCap・lineJoin は呼び出し後に
 * 元へ戻る。
 */
export function drawAnnotationLine(
  ctx: CanvasRenderingContext2D,
  segment: CanvasLineSegment,
  lineStyle: LineStyle,
  strokeWidthPx: number
): void {
  ctx.save()
  ctx.lineWidth = strokeWidthPx
  ctx.setLineDash([])
  ctx.lineCap = "round"
  ctx.lineJoin = "round"

  const dx = segment.endX - segment.startX
  const dy = segment.endY - segment.startY
  const lineLength = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx)
  const arrowSize = strokeWidthPx * 5

  // 波線・ジグザグは長さや線幅で割って波を刻むので、どちらかが 0 だと 0 除算になる
  // （線幅 0 では刻みが 0 になり、頂点を並べるループが終わらない）。形を作れないので直線で描く
  const isDegenerate = lineLength === 0 || strokeWidthPx <= 0
  const effectiveLineStyle =
    isDegenerate && (lineStyle === "wave" || lineStyle === "zigzag")
      ? "solid"
      : lineStyle

  switch (effectiveLineStyle) {
    case "wave":
      drawWaveLine(ctx, segment, dx, dy, lineLength, angle, strokeWidthPx)
      break
    case "zigzag":
      drawZigzagLine(ctx, segment, dx, dy, lineLength, angle, strokeWidthPx)
      break
    case "double":
      drawDoubleLine(ctx, segment, angle, strokeWidthPx)
      break
    case "arrow":
      drawStraightLine(ctx, segment)
      drawArrowHead(ctx, segment.endX, segment.endY, angle, arrowSize, -1)
      break
    case "both_arrow":
      drawStraightLine(ctx, segment)
      drawArrowHead(ctx, segment.endX, segment.endY, angle, arrowSize, -1)
      drawArrowHead(ctx, segment.startX, segment.startY, angle, arrowSize, 1)
      break
    case "solid":
      drawStraightLine(ctx, segment)
      break
    default:
      assertNever(effectiveLineStyle)
  }

  ctx.restore()
}

/** 矩形の注釈を描く（角は尖らせる。線幅は ctx の現在の状態のまま） */
export function drawAnnotationRectangle(
  ctx: CanvasRenderingContext2D,
  rectangle: CanvasRectangle
): void {
  ctx.save()
  applyShapeCorners(ctx)
  ctx.strokeRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height)
  ctx.restore()
}

/** 矩形に内接する楕円の注釈を描く（線幅は ctx の現在の状態のまま） */
export function drawAnnotationEllipse(
  ctx: CanvasRenderingContext2D,
  rectangle: CanvasRectangle
): void {
  ctx.save()
  applyShapeCorners(ctx)
  ctx.beginPath()
  ctx.ellipse(
    rectangle.x + rectangle.width / 2,
    rectangle.y + rectangle.height / 2,
    Math.abs(rectangle.width) / 2,
    Math.abs(rectangle.height) / 2,
    0,
    0,
    2 * Math.PI
  )
  ctx.stroke()
  ctx.restore()
}

/** 矩形・楕円の角の形（線の注釈の round とは違い、角を尖らせる） */
function applyShapeCorners(ctx: CanvasRenderingContext2D): void {
  ctx.setLineDash([])
  ctx.lineCap = "butt"
  ctx.lineJoin = "miter"
}

function drawStraightLine(
  ctx: CanvasRenderingContext2D,
  segment: CanvasLineSegment
): void {
  ctx.beginPath()
  ctx.moveTo(segment.startX, segment.startY)
  ctx.lineTo(segment.endX, segment.endY)
  ctx.stroke()
}

/**
 * 波線（cos 波、中央揃え）
 *
 * 線分の中央が波の頂点になる。始点・終点は波の途中で切れてもよい（偶数制約なし）。
 */
function drawWaveLine(
  ctx: CanvasRenderingContext2D,
  segment: CanvasLineSegment,
  dx: number,
  dy: number,
  lineLength: number,
  angle: number,
  strokeWidthPx: number
): void {
  const waveAmplitude = strokeWidthPx * 1.5
  const wavelength = strokeWidthPx * 10 * 2

  const perpX = -Math.sin(angle)
  const perpY = Math.cos(angle)

  const steps = Math.max(Math.ceil((lineLength / wavelength) * 32), 64)

  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps
    const position = ratio * lineLength
    const theta = (2 * Math.PI * (position - lineLength / 2)) / wavelength
    const waveOffset = waveAmplitude * Math.cos(theta)

    const x = segment.startX + dx * ratio + perpX * waveOffset
    const y = segment.startY + dy * ratio + perpY * waveOffset

    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

/**
 * ジグザグ線（cos 位相、中央揃え）
 *
 * 線分の中央が頂点(+A)になるよう、中央から左右対称に頂点を置く。始点・終点は直線上で、
 * 端の頂点が途中で切れることはないが、端のセグメント長は中央部分と異なることがある。
 */
function drawZigzagLine(
  ctx: CanvasRenderingContext2D,
  segment: CanvasLineSegment,
  dx: number,
  dy: number,
  lineLength: number,
  angle: number,
  strokeWidthPx: number
): void {
  const zigAmplitude = strokeWidthPx * 1.5
  const zigPitch = strokeWidthPx * 8

  const perpX = -Math.sin(angle)
  const perpY = Math.cos(angle)

  const center = lineLength / 2
  const peaks: { position: number; amplitude: number }[] = [
    { position: center, amplitude: zigAmplitude },
  ]

  for (let i = 1; center + i * zigPitch < lineLength; i++) {
    const amplitude = (i % 2 === 0 ? 1 : -1) * zigAmplitude
    peaks.push({ position: center + i * zigPitch, amplitude })
  }
  for (let i = 1; center - i * zigPitch > 0; i++) {
    const amplitude = (i % 2 === 0 ? 1 : -1) * zigAmplitude
    peaks.push({ position: center - i * zigPitch, amplitude })
  }

  peaks.sort((peakA, peakB) => peakA.position - peakB.position)

  ctx.beginPath()
  ctx.moveTo(segment.startX, segment.startY)

  peaks.forEach((peak) => {
    const ratio = peak.position / lineLength
    const baseX = segment.startX + dx * ratio
    const baseY = segment.startY + dy * ratio
    ctx.lineTo(baseX + perpX * peak.amplitude, baseY + perpY * peak.amplitude)
  })

  ctx.lineTo(segment.startX + dx, segment.startY + dy)
  ctx.stroke()
}

/** 二重線（線幅ぶん左右へずらした2本） */
function drawDoubleLine(
  ctx: CanvasRenderingContext2D,
  segment: CanvasLineSegment,
  angle: number,
  strokeWidthPx: number
): void {
  const perpX = -Math.sin(angle) * strokeWidthPx
  const perpY = Math.cos(angle) * strokeWidthPx

  ctx.beginPath()
  ctx.moveTo(segment.startX + perpX, segment.startY + perpY)
  ctx.lineTo(segment.endX + perpX, segment.endY + perpY)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(segment.startX - perpX, segment.startY - perpY)
  ctx.lineTo(segment.endX - perpX, segment.endY - perpY)
  ctx.stroke()
}

/**
 * 塗りつぶした矢じり
 *
 * `direction` は先端から胴を伸ばす向き。終点の矢じりは線の向きと逆（-1）へ、
 * 始点の矢じりは線の向き（+1）へ伸ばす。
 */
function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  angle: number,
  arrowSize: number,
  direction: 1 | -1
): void {
  const reach = direction * arrowSize
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(
    tipX + reach * Math.cos(angle - ARROW_HEAD_HALF_ANGLE),
    tipY + reach * Math.sin(angle - ARROW_HEAD_HALF_ANGLE)
  )
  ctx.lineTo(
    tipX + reach * Math.cos(angle + ARROW_HEAD_HALF_ANGLE),
    tipY + reach * Math.sin(angle + ARROW_HEAD_HALF_ANGLE)
  )
  ctx.closePath()
  ctx.fill()
}
