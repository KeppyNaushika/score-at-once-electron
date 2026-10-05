/**
 * メインキャンバスの描画
 * - 答案ページを縦に積む
 * - 全設問の枠と採点記号（drawCropRegionMarks）
 * - 描画要素（テキスト以外。テキストは drawTextCanvas が別キャンバスに描く）
 * - 範囲選択の矩形
 */
import type { SelectionRectangle } from "@/components/exams/07-score-at-once/ScoringIndividual/types"
import type { ScoringData } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type {
  AnnotationWithContext,
  DrawingAnnotation,
} from "@/types/drawingAnnotation.types"
import type { AnswerOverlaySettings } from "@/types/scoringOverlay.types"

import {
  fillNameMasks,
  type Rect,
} from "../../ScoringMain/utils/nameRegionMasks"
import type { CropRegionWithStatus } from "../hooks/core/types"
import type { useDrawingRenderer } from "../hooks/core/useDrawingRenderer"
import {
  pageIndexByCropRegionId,
  pageIndexOfCropRegion,
  pageOffsetX,
  pageOffsetY,
  stackedCanvasSize,
} from "./canvasPageLayout"
import { drawCropRegionMarks } from "./drawCropRegionMarks"

interface MainCanvasParams {
  pageSpacing: number
  zoom: number
  pageSize: string
  /** ページごとの、塗りつぶす氏名欄（images と同じ並び。匿名採点中でなければ空） */
  nameRegionsByPageIndex: readonly (readonly Rect[])[]
  currentCropRegion: QuestionAnswerRegionRow | null | undefined
  currentCropRegionId: string | null | undefined
  currentScoringData: ScoringData | null
  allCropRegionsWithStatus: CropRegionWithStatus[]
  allAnnotations: AnnotationWithContext[]
  drawingElements: DrawingAnnotation[]
  selectedElementIds: string[]
  selectionRectangle: SelectionRectangle | null
  isDrawing: boolean
  isDrawingSelection: boolean
  /** 描画要素をドラッグ中か（呼び出し時点の値） */
  isElementDragging: boolean
  scoringMarkConfig: AnswerOverlaySettings | null | undefined
  scoringMarkImages: Map<string, HTMLImageElement>
  drawSingleElement: ReturnType<typeof useDrawingRenderer>["drawSingleElement"]
}

/** メインキャンバスを描き直す */
export function drawMainCanvas(
  canvas: HTMLCanvasElement,
  images: HTMLImageElement[],
  {
    pageSpacing,
    zoom,
    pageSize,
    nameRegionsByPageIndex,
    currentCropRegion,
    currentCropRegionId,
    currentScoringData,
    allCropRegionsWithStatus,
    allAnnotations,
    drawingElements,
    selectedElementIds,
    selectionRectangle,
    isDrawing,
    isDrawingSelection,
    isElementDragging,
    scoringMarkConfig,
    scoringMarkImages,
    drawSingleElement,
  }: MainCanvasParams
): void {
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  if (images.length === 0) return

  const { width: canvasWidth, height: totalHeight } = stackedCanvasSize(
    images,
    pageSpacing
  )

  canvas.width = canvasWidth
  canvas.height = totalHeight

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "rgba(255, 255, 0, 0.1)"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.globalCompositeOperation = "source-over"
  ctx.globalAlpha = 1.0
  ctx.lineCap = "butt"
  ctx.lineJoin = "miter"
  ctx.miterLimit = 10
  ctx.setLineDash([])

  drawPageStack(ctx, canvas, images, canvasWidth, pageSpacing)

  // 匿名採点中は氏名欄を塗りつぶす（ページの直後、枠・記号・描画要素より下）
  images.forEach((image, index) => {
    fillNameMasks(
      ctx,
      nameRegionsByPageIndex[index] ?? [],
      { x: 0, y: 0, width: 1, height: 1 },
      {
        x: pageOffsetX(canvasWidth, image),
        y: pageOffsetY(images, index, pageSpacing),
        width: image.naturalWidth,
        height: image.naturalHeight,
      }
    )
  })

  // 全設問の枠と採点記号・点数を描画
  drawCropRegionMarks(
    {
      ctx,
      images,
      canvasWidth,
      pageSpacing,
      zoom,
      scoringMarkConfig,
      scoringMarkImages,
    },
    { allCropRegionsWithStatus, currentCropRegion, currentScoringData }
  )

  // cropRegionId → pageIndex のルックアップマップ
  const cropRegionPageIndexMap = pageIndexByCropRegionId(
    allCropRegionsWithStatus,
    images.length
  )

  // 現在設問のページオフセットを計算
  const currentPageIndex = pageIndexOfCropRegion(
    currentCropRegion,
    images.length
  )
  const currentPageImg = images[currentPageIndex] || images[0]
  const currentOffsetX = pageOffsetX(canvasWidth, currentPageImg)
  const currentOffsetY = pageOffsetY(images, currentPageIndex, pageSpacing)

  const isAnyElementDragging =
    isElementDragging && selectedElementIds.length > 0
  const isDragging = isDrawing || isAnyElementDragging || isDrawingSelection

  // 他設問のアノテーション（テキスト以外）
  if (!isDragging) {
    for (const annotation of allAnnotations) {
      if (annotation.questionScore?.cropRegionId === currentCropRegionId) {
        continue
      }
      if (annotation.type === "text") {
        continue
      }

      // アノテーションが属するページのオフセットを計算
      const annotPageIndex =
        cropRegionPageIndexMap.get(
          annotation.questionScore?.cropRegionId || ""
        ) ?? 0
      const annotPageImg = images[annotPageIndex] || images[0]

      ctx.globalAlpha = 0.5
      drawSingleElement(
        ctx,
        annotation,
        annotPageImg,
        pageOffsetX(canvasWidth, annotPageImg),
        pageOffsetY(images, annotPageIndex, pageSpacing),
        pageSize
      )
      ctx.globalAlpha = 1.0
    }
  }

  // 現在設問の描画要素（テキスト以外）
  for (const element of drawingElements) {
    if (element.type === "text") {
      continue
    }

    const isSelected = selectedElementIds.includes(element.id)
    ctx.globalAlpha = isDragging && !isSelected ? 0.3 : 1.0
    drawSingleElement(
      ctx,
      element,
      currentPageImg,
      currentOffsetX,
      currentOffsetY,
      pageSize
    )
    ctx.globalAlpha = 1.0
  }

  // 選択範囲矩形の描画
  if (isDrawingSelection && selectionRectangle) {
    ctx.save()
    ctx.strokeStyle = "#2563eb"
    ctx.setLineDash([5, 5])
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.6

    const rectX =
      selectionRectangle.x * currentPageImg.naturalWidth + currentOffsetX
    const rectY =
      selectionRectangle.y * currentPageImg.naturalHeight + currentOffsetY
    const rectWidth = selectionRectangle.width * currentPageImg.naturalWidth
    const rectHeight = selectionRectangle.height * currentPageImg.naturalHeight

    ctx.strokeRect(rectX, rectY, rectWidth, rectHeight)

    ctx.fillStyle = "#2563eb"
    ctx.globalAlpha = 0.1
    ctx.fillRect(rectX, rectY, rectWidth, rectHeight)

    ctx.restore()
  }
}

/** 答案ページを縦に積み、ページの境目に破線を引く */
function drawPageStack(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  images: HTMLImageElement[],
  canvasWidth: number,
  pageSpacing: number
): void {
  images.forEach((image, index) => {
    const offsetX = pageOffsetX(canvasWidth, image)
    const offsetY = pageOffsetY(images, index, pageSpacing)

    ctx.drawImage(image, offsetX, offsetY)

    if (images.length > 1 && index < images.length - 1) {
      ctx.strokeStyle = "#e5e7eb"
      ctx.lineWidth = 1
      ctx.setLineDash([5, 5])
      const borderY = offsetY + image.naturalHeight + pageSpacing / 2
      ctx.beginPath()
      ctx.moveTo(0, borderY)
      ctx.lineTo(canvas.width, borderY)
      ctx.stroke()
      ctx.setLineDash([])
    }
  })
}
