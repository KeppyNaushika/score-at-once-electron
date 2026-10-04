/**
 * テキスト専用キャンバスの描画
 *
 * 数式のレンダリングが非同期なので、テキストだけを別のキャンバスに描く。
 * 描いたついでに、現在設問のテキストの外接矩形（ページ内の正規化座標）を
 * textBoundsCache へ書き戻す（当たり判定が使う）。
 */
import { mmToPixels } from "@/lib/paperSize"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type {
  AnnotationWithContext,
  DrawingAnnotation,
} from "@/types/drawingAnnotation.types"

import type { CropRegionWithStatus } from "../hooks/core/types"
import {
  pageIndexByCropRegionId,
  pageIndexOfCropRegion,
  pageOffsetY,
  stackedCanvasSize,
} from "./canvasPageLayout"
import { renderTextElement } from "./canvasTextRenderer"

interface TextCanvasParams {
  pageSpacing: number
  pageSize: string
  currentCropRegion: QuestionAnswerRegionRow | null | undefined
  currentCropRegionId: string | null | undefined
  allCropRegionsWithStatus: CropRegionWithStatus[]
  allAnnotations: AnnotationWithContext[]
  drawingElements: DrawingAnnotation[]
  selectedElementIds: string[]
  textBoundsCache: Map<
    string,
    { x: number; y: number; width: number; height: number }
  >
}

/** テキストキャンバスを描き直す */
export async function drawTextCanvas(
  textCanvas: HTMLCanvasElement,
  loadedImages: HTMLImageElement[],
  {
    pageSpacing,
    pageSize,
    currentCropRegion,
    currentCropRegionId,
    allCropRegionsWithStatus,
    allAnnotations,
    drawingElements,
    selectedElementIds,
    textBoundsCache,
  }: TextCanvasParams
): Promise<void> {
  const ctx = textCanvas.getContext("2d")
  if (!ctx) return

  const { width: canvasWidth, height: totalHeight } = stackedCanvasSize(
    loadedImages,
    pageSpacing
  )

  textCanvas.width = canvasWidth
  textCanvas.height = totalHeight

  ctx.clearRect(0, 0, textCanvas.width, textCanvas.height)

  textBoundsCache.clear()

  // cropRegionId → pageIndex ルックアップマップ
  const textCropRegionPageMap = pageIndexByCropRegionId(
    allCropRegionsWithStatus,
    loadedImages.length
  )

  // 現在設問のページ情報
  const currentPageIndex = pageIndexOfCropRegion(
    currentCropRegion,
    loadedImages.length
  )
  const currentPageImg = loadedImages[currentPageIndex] || loadedImages[0]
  const currentPageHeight = currentPageImg.naturalHeight
  const currentPageOffsetY = pageOffsetY(
    loadedImages,
    currentPageIndex,
    pageSpacing
  )

  const drawingElementsMap = new Map(
    drawingElements.map((element) => [element.id, element])
  )

  // 全テキストをallAnnotationsから描画
  const textAnnotations = allAnnotations.filter(
    (annotation) => annotation.type === "text" && annotation.text
  )
  const drawnIds = new Set(textAnnotations.map((annotation) => annotation.id))

  const annotationResults = await Promise.all(
    textAnnotations.map(async (annotation) => {
      const isCurrentQuestion =
        annotation.questionScore?.cropRegionId === currentCropRegionId

      // 現在の設問はローカル状態（編集中の値）を優先する。
      // drawingElements に無い＝ローカルで削除済み → 描画スキップ
      const localElement = isCurrentQuestion
        ? drawingElementsMap.get(annotation.id)
        : undefined
      if (isCurrentQuestion && !localElement) return null
      const element: DrawingAnnotation = localElement ?? annotation

      const isSelected =
        isCurrentQuestion && selectedElementIds.includes(element.id)

      // アノテーションが属するページを特定
      const annotCropRegionId = annotation.questionScore?.cropRegionId || ""
      const annotPageIndex = textCropRegionPageMap.get(annotCropRegionId) ?? 0
      const annotPageImg = loadedImages[annotPageIndex] || loadedImages[0]
      const annotPageHeight = annotPageImg.naturalHeight
      const annotPageOffsetY = pageOffsetY(
        loadedImages,
        annotPageIndex,
        pageSpacing
      )

      try {
        // ページオフセット分だけコンテキストを平行移動して描画
        ctx.save()
        ctx.translate(0, annotPageOffsetY)
        const fontSizePx = mmToPixels(
          element.fontSize,
          pageSize,
          canvasWidth,
          annotPageHeight
        )
        const pxElement = { ...element, fontSize: fontSizePx }
        const result = await renderTextElement(
          ctx,
          pxElement,
          canvasWidth,
          annotPageHeight,
          isSelected,
          isCurrentQuestion,
          isCurrentQuestion ? 1.0 : 0.3
        )
        ctx.restore()
        return {
          element,
          result,
          isCurrentQuestion,
          pageHeight: annotPageHeight,
        }
      } catch {
        ctx.restore()
        return null
      }
    })
  )

  // 現在設問のテキストをキャッシュ（ページ内正規化座標）
  for (const item of annotationResults) {
    if (item && item.isCurrentQuestion && item.result.success) {
      textBoundsCache.set(item.element.id, {
        x: item.result.textBounds.x / canvasWidth,
        y: item.result.textBounds.y / item.pageHeight,
        width: item.result.textBounds.width / canvasWidth,
        height: item.result.textBounds.height / item.pageHeight,
      })
    }
  }

  // 新規作成直後の要素（現在設問のページに描画）
  const newTextElements = drawingElements.filter(
    (element) =>
      element.type === "text" && element.text && !drawnIds.has(element.id)
  )

  if (newTextElements.length > 0) {
    const newResults = await Promise.all(
      newTextElements.map(async (element) => {
        const isSelected = selectedElementIds.includes(element.id)
        try {
          ctx.save()
          ctx.translate(0, currentPageOffsetY)
          const fontSizePx = mmToPixels(
            element.fontSize,
            pageSize,
            canvasWidth,
            currentPageHeight
          )
          const pxElement = { ...element, fontSize: fontSizePx }
          const result = await renderTextElement(
            ctx,
            pxElement,
            canvasWidth,
            currentPageHeight,
            isSelected,
            true,
            1.0
          )
          ctx.restore()
          return { element, result }
        } catch {
          ctx.restore()
          return null
        }
      })
    )

    for (const item of newResults) {
      if (item && item.result.success) {
        textBoundsCache.set(item.element.id, {
          x: item.result.textBounds.x / canvasWidth,
          y: item.result.textBounds.y / currentPageHeight,
          width: item.result.textBounds.width / canvasWidth,
          height: item.result.textBounds.height / currentPageHeight,
        })
      }
    }
  }
}
