/**
 * 採点マーク画像・点数テキストのCanvas描画
 */

import {
  calculateMarkPosition,
  calculatePartialScorePosition,
} from "./markPosition"
import { getTintedMark } from "./markTinting"
import type {
  ScoringDataForPdf,
  ScoringMarkConfigForPdf,
  SubtotalDataForPdf,
  TotalScoreDataForPdf,
} from "./types"

/**
 * 採点マーク画像を描画
 */
export function drawScoringMark(
  ctx: CanvasRenderingContext2D,
  markImage: HTMLImageElement,
  region: ScoringDataForPdf["cropRegion"],
  config: ScoringMarkConfigForPdf,
  imageWidth: number,
  imageHeight: number
): void {
  const regionX = region.x * imageWidth
  const regionY = region.y * imageHeight
  const regionWidth = region.width * imageWidth
  const regionHeight = region.height * imageHeight

  const markSize = config.markSize
  const { x, y } = calculateMarkPosition(
    regionX,
    regionY,
    regionWidth,
    regionHeight,
    markSize,
    config.markPosition
  )

  const opacity = (config.markOpacity ?? 100) / 100
  // markColor指定時は単色シルエットを着色（未指定なら元画像をそのまま使用）
  const drawable = config.markColor
    ? getTintedMark(markImage, config.markColor)
    : markImage

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.drawImage(drawable, x, y, markSize, markSize)
  ctx.restore()
}

/**
 * 部分点テキストを描画（色・不透明度は config に従う）
 * @param score - 表示する点数
 */
export function drawScoreText(
  ctx: CanvasRenderingContext2D,
  score: number,
  region: ScoringDataForPdf["cropRegion"],
  config: ScoringMarkConfigForPdf,
  imageWidth: number,
  imageHeight: number
): void {
  if (!config.showPartialScore) return

  const regionX = region.x * imageWidth
  const regionY = region.y * imageHeight
  const regionWidth = region.width * imageWidth
  const regionHeight = region.height * imageHeight

  const { x, y } = calculatePartialScorePosition(
    regionX,
    regionY,
    regionWidth,
    regionHeight,
    config.partialScorePosition,
    config.partialScoreOffsetX,
    config.partialScoreOffsetY
  )

  ctx.save()
  ctx.globalAlpha = (config.partialScoreOpacity ?? 100) / 100
  ctx.font = `bold ${config.partialScoreSize}px sans-serif`
  ctx.fillStyle = config.partialScoreColor || "#ef4444"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(String(score), x, y)
  ctx.restore()
}

/**
 * 小計点テキストを描画（色・不透明度は config に従う）
 */
export function drawSubtotalScoreText(
  ctx: CanvasRenderingContext2D,
  subtotalData: SubtotalDataForPdf,
  config: ScoringMarkConfigForPdf,
  imageWidth: number,
  imageHeight: number
): void {
  const regionX = subtotalData.x * imageWidth
  const regionY = subtotalData.y * imageHeight
  const regionWidth = subtotalData.width * imageWidth
  const regionHeight = subtotalData.height * imageHeight

  const { x, y } = calculatePartialScorePosition(
    regionX,
    regionY,
    regionWidth,
    regionHeight,
    config.subtotalScorePosition,
    config.subtotalScoreOffsetX,
    config.subtotalScoreOffsetY
  )

  ctx.save()
  ctx.globalAlpha = (config.subtotalScoreOpacity ?? 100) / 100
  ctx.font = `bold ${config.subtotalScoreSize}px sans-serif`
  ctx.fillStyle = config.subtotalScoreColor || "#2563eb"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(String(subtotalData.score), x, y)
  ctx.restore()
}

/**
 * 合計点テキストを描画（色・不透明度は config に従う）
 */
export function drawTotalScoreText(
  ctx: CanvasRenderingContext2D,
  totalScoreData: TotalScoreDataForPdf,
  config: ScoringMarkConfigForPdf,
  imageWidth: number,
  imageHeight: number
): void {
  const regionX = totalScoreData.x * imageWidth
  const regionY = totalScoreData.y * imageHeight
  const regionWidth = totalScoreData.width * imageWidth
  const regionHeight = totalScoreData.height * imageHeight

  const { x, y } = calculatePartialScorePosition(
    regionX,
    regionY,
    regionWidth,
    regionHeight,
    config.totalScorePosition,
    config.totalScoreOffsetX,
    config.totalScoreOffsetY
  )

  ctx.save()
  ctx.globalAlpha = (config.totalScoreOpacity ?? 100) / 100
  ctx.font = `bold ${config.totalScoreSize}px sans-serif`
  ctx.fillStyle = config.totalScoreColor || "#2563eb"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(String(totalScoreData.score), x, y)
  ctx.restore()
}
