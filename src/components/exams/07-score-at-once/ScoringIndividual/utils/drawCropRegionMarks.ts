/**
 * メインキャンバスに、全設問の枠・ラベル・採点記号・点数を描く
 */
import type { ScoringData } from "@/components/exams/07-score-at-once/types"
import {
  resolveAnchorPoint,
  resolveImageOrigin,
  resolveTextAnchor,
} from "@/lib/answerOverlayPlacement"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { AnswerOverlaySettings } from "@/types/scoringOverlay.types"
import { DEFAULT_ANSWER_OVERLAY_SETTINGS } from "@/types/scoringOverlay.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import type { CropRegionWithStatus } from "../hooks/core/types"
import { getScoringMarkKey } from "../hooks/core/useScoringMarks"
import { pageOffsetX, pageOffsetY } from "./canvasPageLayout"

// 透明度定数
const CURRENT_OPACITY = 0.8
const OTHER_OPACITY = 0.4

interface CropRegionMarksParams {
  ctx: CanvasRenderingContext2D
  images: HTMLImageElement[]
  canvasWidth: number
  pageSpacing: number
  zoom: number
  scoringMarkConfig: AnswerOverlaySettings | null | undefined
  scoringMarkImages: Map<string, HTMLImageElement>
}

/**
 * 他の設問を先に半透明で描き、現在の設問を最後に前面へ描く
 */
export function drawCropRegionMarks(
  params: CropRegionMarksParams,
  {
    allCropRegionsWithStatus,
    currentCropRegion,
    currentScoringData,
  }: {
    allCropRegionsWithStatus: CropRegionWithStatus[]
    currentCropRegion: QuestionAnswerRegionRow | null | undefined
    currentScoringData: ScoringData | null
  }
): void {
  // 他の設問を先に描画（半透明）
  for (const { cropRegion, status, actualScore } of allCropRegionsWithStatus) {
    if (cropRegion.id === currentCropRegion?.id) continue
    drawCropRegionMark(params, cropRegion, status, false, actualScore)
  }

  // 現在の設問を最後に描画（前面に表示）
  if (currentCropRegion) {
    const currentStatus = currentScoringData?.status ?? "unscored"
    // 現在の設問のスコアをallCropRegionsWithStatusから取得
    const currentRegionData = allCropRegionsWithStatus.find(
      (cropRegionWithStatus) =>
        cropRegionWithStatus.cropRegion.id === currentCropRegion.id
    )
    drawCropRegionMark(
      params,
      currentCropRegion,
      currentStatus,
      true,
      currentRegionData?.actualScore ?? null
    )
  }
}

/** 1設問分の枠・ラベル・採点記号・点数 */
function drawCropRegionMark(
  {
    ctx,
    images,
    canvasWidth,
    pageSpacing,
    zoom,
    scoringMarkConfig,
    scoringMarkImages,
  }: CropRegionMarksParams,
  region: QuestionAnswerRegionRow,
  status: ScoringStatus,
  isCurrent: boolean,
  actualScore: number | null
): void {
  const regionPageNumber = region.examPage?.pageNumber || 1
  const regionPageIndex = regionPageNumber - 1

  if (regionPageIndex < 0 || regionPageIndex >= images.length) return

  const image = images[regionPageIndex]
  if (!image) return

  const offsetX = pageOffsetX(canvasWidth, image)
  const offsetY = pageOffsetY(images, regionPageIndex, pageSpacing)

  const regionRect = {
    x: region.x * image.naturalWidth + offsetX,
    y: region.y * image.naturalHeight + offsetY,
    width: region.width * image.naturalWidth,
    height: region.height * image.naturalHeight,
  }

  const opacity = isCurrent ? CURRENT_OPACITY : OTHER_OPACITY

  // 枠とラベルの描画
  if (isCurrent) {
    ctx.strokeStyle = "#22c55e"
    ctx.lineWidth = 2
  } else {
    ctx.strokeStyle = "#9ca3af"
    ctx.lineWidth = 1
  }
  ctx.setLineDash([])
  ctx.globalAlpha = opacity
  ctx.strokeRect(
    regionRect.x,
    regionRect.y,
    regionRect.width,
    regionRect.height
  )

  const labelFontSize = Math.max(12, 14 / zoom)
  ctx.font = `${labelFontSize}px sans-serif`
  ctx.fillStyle = isCurrent ? "#22c55e" : "#9ca3af"
  ctx.fillText(region.label, regionRect.x, regionRect.y - 5)

  // 採点記号の描画（印字設定に基づく）
  const shouldShowMark = scoringMarkConfig
    ? scoringMarkConfig.visibility[status].showMark
    : status !== "unscored"

  if (shouldShowMark) {
    const markKey = getScoringMarkKey(status)
    const markImage = markKey ? scoringMarkImages.get(markKey) : null

    if (markImage) {
      const markStyle =
        scoringMarkConfig?.styles.mark ??
        DEFAULT_ANSWER_OVERLAY_SETTINGS.styles.mark
      const markPos = resolveImageOrigin(
        resolveAnchorPoint(
          regionRect,
          markStyle.position,
          markStyle.offsetX,
          markStyle.offsetY,
          true
        ),
        markStyle.anchor,
        markStyle.size
      )

      ctx.globalAlpha = opacity
      ctx.drawImage(
        markImage,
        markPos.x,
        markPos.y,
        markStyle.size,
        markStyle.size
      )
    }
  }

  // 点数テキストの描画（印字設定に基づく）
  const shouldShowScore = scoringMarkConfig
    ? scoringMarkConfig.visibility[status].showScore
    : false

  if (shouldShowScore && actualScore !== null) {
    ctx.save()
    const scoreStyle =
      scoringMarkConfig?.styles.partial ??
      DEFAULT_ANSWER_OVERLAY_SETTINGS.styles.partial
    const { textAlign, textBaseline } = resolveTextAnchor(scoreStyle.anchor)

    ctx.font = `bold ${scoreStyle.size}px sans-serif`
    ctx.fillStyle = scoreStyle.color
    ctx.globalAlpha = opacity
    ctx.textAlign = textAlign
    ctx.textBaseline = textBaseline

    const scorePos = resolveAnchorPoint(
      regionRect,
      scoreStyle.position,
      scoreStyle.offsetX,
      scoreStyle.offsetY
    )
    ctx.fillText(String(actualScore), scorePos.x, scorePos.y)
    ctx.restore()
  }

  ctx.globalAlpha = 1.0
}
