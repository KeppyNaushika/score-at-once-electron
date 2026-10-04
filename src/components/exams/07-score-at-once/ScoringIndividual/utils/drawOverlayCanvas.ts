/**
 * オーバーレイキャンバスの描画（ハンドル専用）
 * - ホバー中・選択中の描画要素のハンドル
 * - テキストをドラッグしている間の簡易表示
 */
import { getTextPositionFromAnchor } from "@/lib/textbox-canvas/canvasUtils"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import {
  pageIndexOfCropRegion,
  pageOffsetX,
  pageOffsetY,
  stackedCanvasSize,
} from "./canvasPageLayout"

interface OverlayCanvasParams {
  pageSpacing: number
  zoom: number
  currentCropRegion: QuestionAnswerRegionRow | null | undefined
  drawingElements: DrawingAnnotation[]
  selectedElementIds: string[]
  hoveredElementId: string | null | undefined
  isDraggingElement: boolean | undefined
}

/** 描画要素の位置をキャンバス座標へ写すための、現在設問のページ */
interface PagePlacement {
  pageImage: HTMLImageElement
  offsetX: number
  offsetY: number
}

/** オーバーレイキャンバスを描き直す */
export function drawOverlayCanvas(
  overlayCanvas: HTMLCanvasElement,
  loadedImages: HTMLImageElement[],
  {
    pageSpacing,
    zoom,
    currentCropRegion,
    drawingElements,
    selectedElementIds,
    hoveredElementId,
    isDraggingElement,
  }: OverlayCanvasParams
): void {
  const ctx = overlayCanvas.getContext("2d")
  if (!ctx) return

  const { width: canvasWidth, height: totalHeight } = stackedCanvasSize(
    loadedImages,
    pageSpacing
  )

  overlayCanvas.width = canvasWidth
  overlayCanvas.height = totalHeight

  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

  // 現在設問のページオフセットを計算
  const currentPageIndex = pageIndexOfCropRegion(
    currentCropRegion,
    loadedImages.length
  )
  const currentPageImg = loadedImages[currentPageIndex] || loadedImages[0]
  const placement: PagePlacement = {
    pageImage: currentPageImg,
    offsetX: pageOffsetX(canvasWidth, currentPageImg),
    offsetY: pageOffsetY(loadedImages, currentPageIndex, pageSpacing),
  }

  const baseHandleSize = 8
  const handleSize = baseHandleSize / zoom

  // ホバー中要素のハンドルを描画
  if (hoveredElementId && !selectedElementIds.includes(hoveredElementId)) {
    const hoveredElement = drawingElements.find(
      (element) => element.id === hoveredElementId
    )
    if (hoveredElement) {
      drawElementHandles(
        ctx,
        placement,
        hoveredElement,
        handleSize,
        "#3b82f6",
        0.5
      )
    }
  }

  // 選択中要素のハンドルを描画
  selectedElementIds.forEach((id) => {
    const element = drawingElements.find(
      (candidateElement) => candidateElement.id === id
    )
    if (!element) return
    drawElementHandles(ctx, placement, element, handleSize, "#3b82f6", 1.0)
  })

  // テキスト要素のドラッグ中: 簡易表示
  if (isDraggingElement) {
    selectedElementIds.forEach((id) => {
      const element = drawingElements.find(
        (candidateElement) => candidateElement.id === id
      )
      if (!element || element.type !== "text") return
      drawDraggingTextPreview(ctx, placement, element)
    })
  }
}

/** 1要素のハンドル（線は始点緑・終点赤、矩形と楕円は四隅、テキストはアンカー） */
function drawElementHandles(
  ctx: CanvasRenderingContext2D,
  { pageImage, offsetX, offsetY }: PagePlacement,
  element: DrawingAnnotation,
  handleSize: number,
  fillColor: string,
  opacity: number
): void {
  const halfHandle = handleSize / 2
  const drawHandle = (x: number, y: number) => {
    ctx.fillRect(x - halfHandle, y - halfHandle, handleSize, handleSize)
    ctx.strokeRect(x - halfHandle, y - halfHandle, handleSize, handleSize)
  }

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.fillStyle = fillColor
  ctx.strokeStyle = "#ffffff"
  ctx.lineWidth = 2

  switch (element.type) {
    case "line": {
      ctx.fillStyle = opacity < 1.0 ? fillColor : "#22c55e"
      drawHandle(
        element.x * pageImage.naturalWidth + offsetX,
        element.y * pageImage.naturalHeight + offsetY
      )

      ctx.fillStyle = opacity < 1.0 ? fillColor : "#ef4444"
      drawHandle(
        element.endX * pageImage.naturalWidth + offsetX,
        element.endY * pageImage.naturalHeight + offsetY
      )
      break
    }
    case "rectangle":
    case "ellipse": {
      const x = element.x * pageImage.naturalWidth + offsetX
      const y = element.y * pageImage.naturalHeight + offsetY
      const w = element.width * pageImage.naturalWidth
      const h = element.height * pageImage.naturalHeight
      const corners = [
        { x, y },
        { x: x + w, y },
        { x, y: y + h },
        { x: x + w, y: y + h },
      ]
      corners.forEach((corner) => drawHandle(corner.x, corner.y))
      break
    }
    case "text":
      if (element.text) {
        drawHandle(
          element.x * pageImage.naturalWidth + offsetX,
          element.y * pageImage.naturalHeight + offsetY
        )
      }
      break
  }
  ctx.restore()
}

/** ドラッグ中のテキストは描き直しが重いので、枠と先頭10文字だけを出す */
function drawDraggingTextPreview(
  ctx: CanvasRenderingContext2D,
  { pageImage, offsetX, offsetY }: PagePlacement,
  element: DrawingAnnotation
): void {
  ctx.save()
  ctx.strokeStyle = element.color
  ctx.setLineDash([5, 5])
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.7

  const anchorX = element.x * pageImage.naturalWidth + offsetX
  const anchorY = element.y * pageImage.naturalHeight + offsetY

  const boundingWidth = element.text
    ? Math.max(element.text.length * element.fontSize * 0.6, 50)
    : 50
  const boundingHeight = Math.max(element.fontSize * 1.2, 20)

  const textPos = getTextPositionFromAnchor(
    anchorX,
    anchorY,
    boundingWidth,
    boundingHeight,
    element.anchorDirection
  )

  ctx.strokeRect(textPos.x, textPos.y, boundingWidth, boundingHeight)

  ctx.font = "12px sans-serif"
  ctx.fillStyle = element.color
  ctx.globalAlpha = 0.8
  ctx.setLineDash([])
  const shortText = element.text
    ? element.text.length > 10
      ? element.text.substring(0, 10) + "..."
      : element.text
    : "Text"
  ctx.fillText(shortText, textPos.x + 5, textPos.y + 15)

  ctx.restore()
}
