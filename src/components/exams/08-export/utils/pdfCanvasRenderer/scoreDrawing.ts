/**
 * 採点マーク画像・点数テキストのCanvas描画
 *
 * 配置はすべて AnswerOverlayStyle（position / anchor / offset / size）で決まる。
 * 画像も文字も同じアンカー点計算を通し、文字は anchor を textAlign / textBaseline へ写す。
 */

import {
  resolveAnchorPoint,
  resolveImageOrigin,
  resolveTextAnchor,
} from "@/lib/answerOverlayPlacement"
import type {
  AnswerOverlaySettings,
  AnswerOverlayStyle,
} from "@/types/scoringOverlay.types"

import { getTintedMark } from "./markTinting"
import type {
  ScoringDataForPdf,
  SubtotalDataForPdf,
  TotalScoreDataForPdf,
} from "./types"

interface NormalizedRegion {
  x: number
  y: number
  width: number
  height: number
}

/** 0-1 正規化された領域を実ピクセルへ展開する */
function toPixelRegion(
  region: NormalizedRegion,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: region.x * imageWidth,
    y: region.y * imageHeight,
    width: region.width * imageWidth,
    height: region.height * imageHeight,
  }
}

/** 点数テキストを1つ描画する（描画対象ごとの差はスタイルと文字列だけ） */
function drawStyledText(
  ctx: CanvasRenderingContext2D,
  text: string,
  region: NormalizedRegion,
  style: AnswerOverlayStyle,
  imageWidth: number,
  imageHeight: number
): void {
  const pixelRegion = toPixelRegion(region, imageWidth, imageHeight)
  const { x, y } = resolveAnchorPoint(
    pixelRegion,
    style.position,
    style.offsetX,
    style.offsetY
  )
  const { textAlign, textBaseline } = resolveTextAnchor(style.anchor)

  ctx.save()
  ctx.globalAlpha = style.opacity / 100
  ctx.font = `bold ${style.size}px sans-serif`
  ctx.fillStyle = style.color
  ctx.textAlign = textAlign
  ctx.textBaseline = textBaseline
  ctx.fillText(text, x, y)
  ctx.restore()
}

/**
 * 採点マーク画像を描画
 */
export function drawScoringMark(
  ctx: CanvasRenderingContext2D,
  markImage: HTMLImageElement,
  region: ScoringDataForPdf["cropRegion"],
  config: AnswerOverlaySettings,
  imageWidth: number,
  imageHeight: number
): void {
  const style = config.styles.mark
  const pixelRegion = toPixelRegion(region, imageWidth, imageHeight)
  const anchorPoint = resolveAnchorPoint(
    pixelRegion,
    style.position,
    style.offsetX,
    style.offsetY,
    true
  )
  const { x, y } = resolveImageOrigin(anchorPoint, style.anchor, style.size)

  ctx.save()
  ctx.globalAlpha = style.opacity / 100
  ctx.drawImage(
    getTintedMark(markImage, style.color),
    x,
    y,
    style.size,
    style.size
  )
  ctx.restore()
}

/**
 * 設問ごとの点数テキストを描画
 */
export function drawScoreText(
  ctx: CanvasRenderingContext2D,
  score: number,
  region: ScoringDataForPdf["cropRegion"],
  config: AnswerOverlaySettings,
  imageWidth: number,
  imageHeight: number
): void {
  drawStyledText(
    ctx,
    String(score),
    region,
    config.styles.partial,
    imageWidth,
    imageHeight
  )
}

/**
 * 小計点テキストを描画
 */
export function drawSubtotalScoreText(
  ctx: CanvasRenderingContext2D,
  subtotalData: SubtotalDataForPdf,
  config: AnswerOverlaySettings,
  imageWidth: number,
  imageHeight: number
): void {
  drawStyledText(
    ctx,
    String(subtotalData.score),
    subtotalData,
    config.styles.subtotal,
    imageWidth,
    imageHeight
  )
}

/**
 * 合計点テキストを描画
 */
export function drawTotalScoreText(
  ctx: CanvasRenderingContext2D,
  totalScoreData: TotalScoreDataForPdf,
  config: AnswerOverlaySettings,
  imageWidth: number,
  imageHeight: number
): void {
  drawStyledText(
    ctx,
    String(totalScoreData.score),
    totalScoreData,
    config.styles.total,
    imageWidth,
    imageHeight
  )
}
