/**
 * テキスト専用キャンバスの描画
 *
 * 数式のレンダリングが非同期なので、テキストだけを別のキャンバスに描く。
 * 描いたついでに、現在設問のテキストの外接矩形（ページ内の正規化座標）を
 * textBoundsCache へ書き戻す（当たり判定が使う）。
 *
 * 座標と文字の大きさは、図形（useDrawingRenderer）と同じく**そのページの画像の幅と高さ**
 * で換算し、幅の狭いページは中央へ寄せる。キャンバスの幅（＝1ページ目の幅）で換算すると、
 * ページごとに画像の大きさが違う答案でテキストだけが図形や PDF からずれる。
 */
import { mmToPixels } from "@/lib/paperSize"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type {
  AnnotationWithContext,
  DrawingAnnotation,
} from "@/types/drawingAnnotation.types"

import type { CropRegionWithStatus } from "../hooks/core/types"
import {
  loadedPageIndexOfCropRegion,
  pageIndexByCropRegionId,
  pagePlacementAt,
  stackedCanvasSize,
} from "./canvasPageLayout"
import { renderTextElement } from "./canvasTextRenderer"

interface TextCanvasParams {
  pageSpacing: number
  pageSize: string
  /** loadedImages と同じ並びの、各画像のページ（ExamPage.id） */
  loadedExamPageIds: readonly string[]
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
    loadedExamPageIds,
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

  // cropRegionId → pageIndex ルックアップマップ（答案に無いページの設問は入らない）
  const textCropRegionPageMap = pageIndexByCropRegionId(
    allCropRegionsWithStatus,
    loadedExamPageIds
  )

  // 現在設問のページ（答案に無ければ null。新規作成直後のテキストも描かない）
  const currentPageIndex = loadedPageIndexOfCropRegion(
    currentCropRegion,
    loadedExamPageIds
  )
  const currentPage =
    currentPageIndex === null
      ? null
      : pagePlacementAt(loadedImages, currentPageIndex, pageSpacing)

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

      // アノテーションが属するページを特定（設問のページが答案に無ければ描かない）
      const annotCropRegionId = annotation.questionScore?.cropRegionId ?? ""
      const annotPageIndex = textCropRegionPageMap.get(annotCropRegionId)
      if (annotPageIndex === undefined) return null
      const {
        pageImage: annotPageImg,
        offsetX: annotPageOffsetX,
        offsetY: annotPageOffsetY,
      } = pagePlacementAt(loadedImages, annotPageIndex, pageSpacing)
      const annotPageWidth = annotPageImg.naturalWidth
      const annotPageHeight = annotPageImg.naturalHeight

      try {
        // ページの左上までコンテキストを平行移動して描画
        ctx.save()
        ctx.translate(annotPageOffsetX, annotPageOffsetY)
        const fontSizePx = mmToPixels(
          element.fontSize,
          pageSize,
          annotPageWidth,
          annotPageHeight
        )
        const pxElement = { ...element, fontSize: fontSizePx }
        const result = await renderTextElement(
          ctx,
          pxElement,
          annotPageWidth,
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
          pageWidth: annotPageWidth,
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
        x: item.result.textBounds.x / item.pageWidth,
        y: item.result.textBounds.y / item.pageHeight,
        width: item.result.textBounds.width / item.pageWidth,
        height: item.result.textBounds.height / item.pageHeight,
      })
    }
  }

  // 新規作成直後の要素（現在設問のページに描画）
  const newTextElements = drawingElements.filter(
    (element) =>
      element.type === "text" && element.text && !drawnIds.has(element.id)
  )

  if (currentPage && newTextElements.length > 0) {
    const {
      pageImage: currentPageImg,
      offsetX: currentPageOffsetX,
      offsetY: currentPageOffsetY,
    } = currentPage
    const currentPageWidth = currentPageImg.naturalWidth
    const currentPageHeight = currentPageImg.naturalHeight
    const newResults = await Promise.all(
      newTextElements.map(async (element) => {
        const isSelected = selectedElementIds.includes(element.id)
        try {
          ctx.save()
          ctx.translate(currentPageOffsetX, currentPageOffsetY)
          const fontSizePx = mmToPixels(
            element.fontSize,
            pageSize,
            currentPageWidth,
            currentPageHeight
          )
          const pxElement = { ...element, fontSize: fontSizePx }
          const result = await renderTextElement(
            ctx,
            pxElement,
            currentPageWidth,
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
          x: item.result.textBounds.x / currentPageWidth,
          y: item.result.textBounds.y / currentPageHeight,
          width: item.result.textBounds.width / currentPageWidth,
          height: item.result.textBounds.height / currentPageHeight,
        })
      }
    }
  }
}
