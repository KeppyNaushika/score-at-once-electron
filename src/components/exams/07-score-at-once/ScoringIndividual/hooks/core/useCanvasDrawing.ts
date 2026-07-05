/**
 * Canvas描画ロジック統合フック
 * - メインキャンバス描画
 * - オーバーレイキャンバス描画（ハンドル）
 * - テキストキャンバス描画
 * - 描画の排他制御
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from "react"

import type {
  DrawingElement,
  SelectionRectangle,
} from "@/components/exams/07-score-at-once/ScoringIndividual/types/answerIndividualTypes"
import type {
  CropRegionWithExamPage,
  ScoringData,
} from "@/components/exams/07-score-at-once/types"
import type {
  MarkPosition,
  ScoringMarkConfig,
} from "@/components/exams/08-export/components/scoring-mark-settings/types/scoringMarkTypes"
import { mmToPixels } from "@/lib/paperSize"
import { getTextPositionFromAnchor } from "@/lib/textbox-canvas/canvasUtils"
import type { DrawingAnnotationWithQuestionScore } from "@/types/drawingAnnotation.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import {
  clearSvgCache,
  renderTextElementV4,
} from "../../utils/canvasTextRendererV4"
import type { CropRegionWithStatus } from "./types"
import { useDrawingRenderer } from "./useDrawingRenderer"
import { getScoringMarkKey } from "./useScoringMarks"

/**
 * 印字設定に基づくマーク位置計算
 */
function calculateMarkPosition(
  regionX: number,
  regionY: number,
  regionWidth: number,
  regionHeight: number,
  markSize: number,
  position: MarkPosition,
  offsetX: number = 0,
  offsetY: number = 0
): { x: number; y: number } {
  const padding = 5
  let x: number
  let y: number

  switch (position) {
    case "top-left":
      x = regionX + padding
      y = regionY + padding
      break
    case "top-center":
      x = regionX + (regionWidth - markSize) / 2
      y = regionY + padding
      break
    case "top-right":
      x = regionX + regionWidth - markSize - padding
      y = regionY + padding
      break
    case "middle-left":
      x = regionX + padding
      y = regionY + (regionHeight - markSize) / 2
      break
    case "middle-right":
      x = regionX + regionWidth - markSize - padding
      y = regionY + (regionHeight - markSize) / 2
      break
    case "bottom-left":
      x = regionX + padding
      y = regionY + regionHeight - markSize - padding
      break
    case "bottom-center":
      x = regionX + (regionWidth - markSize) / 2
      y = regionY + regionHeight - markSize - padding
      break
    case "bottom-right":
      x = regionX + regionWidth - markSize - padding
      y = regionY + regionHeight - markSize - padding
      break
    default: // middle-center
      x = regionX + (regionWidth - markSize) / 2
      y = regionY + (regionHeight - markSize) / 2
      break
  }

  return { x: x + offsetX, y: y + offsetY }
}

/**
 * 印字設定に基づく点数テキスト位置計算
 */
function calculateScorePosition(
  regionX: number,
  regionY: number,
  regionWidth: number,
  regionHeight: number,
  position: MarkPosition,
  offsetX: number = 0,
  offsetY: number = 0
): { x: number; y: number } {
  let baseX: number
  let baseY: number

  switch (position) {
    case "top-left":
      baseX = regionX
      baseY = regionY
      break
    case "top-center":
      baseX = regionX + regionWidth / 2
      baseY = regionY
      break
    case "top-right":
      baseX = regionX + regionWidth
      baseY = regionY
      break
    case "middle-left":
      baseX = regionX
      baseY = regionY + regionHeight / 2
      break
    case "middle-right":
      baseX = regionX + regionWidth
      baseY = regionY + regionHeight / 2
      break
    case "bottom-left":
      baseX = regionX
      baseY = regionY + regionHeight
      break
    case "bottom-center":
      baseX = regionX + regionWidth / 2
      baseY = regionY + regionHeight
      break
    case "bottom-right":
      baseX = regionX + regionWidth
      baseY = regionY + regionHeight
      break
    default: // middle-center
      baseX = regionX + regionWidth / 2
      baseY = regionY + regionHeight / 2
      break
  }

  return { x: baseX + offsetX, y: baseY + offsetY }
}

interface UseCanvasDrawingProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>
  textCanvasRef: React.RefObject<HTMLCanvasElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  textBoundsCacheRef: React.MutableRefObject<
    Map<string, { x: number; y: number; width: number; height: number }>
  >
  scoringMarkImagesRef: React.MutableRefObject<Map<string, HTMLImageElement>>
  imageLoaded: boolean
  loadedImages: HTMLImageElement[]
  currentScoringData: ScoringData | null
  currentCropRegion?: CropRegionWithExamPage | null
  zoom: number
  drawingElements: DrawingElement[]
  selectedElementIds: string[]
  isDrawing: boolean
  isDrawingSelection: boolean
  selectionRectangle: SelectionRectangle | null
  pageSpacing?: number
  isDraggingElement?: boolean
  allAnnotations?: DrawingAnnotationWithQuestionScore[]
  currentCropRegionId?: string | null
  hoveredElementId?: string | null
  allCropRegionsWithStatus?: CropRegionWithStatus[]
  scoringMarkConfig?: ScoringMarkConfig | null
  pageSize?: string
}

/**
 * Canvas描画ロジックを管理するフック
 */
export function useCanvasDrawing({
  canvasRef,
  overlayCanvasRef,
  textCanvasRef,
  containerRef,
  textBoundsCacheRef,
  scoringMarkImagesRef,
  imageLoaded,
  loadedImages,
  currentScoringData,
  currentCropRegion,
  zoom,
  drawingElements,
  selectedElementIds,
  isDrawing,
  isDrawingSelection,
  selectionRectangle,
  pageSpacing = 20,
  isDraggingElement,
  allAnnotations = [],
  currentCropRegionId,
  hoveredElementId,
  allCropRegionsWithStatus = [],
  scoringMarkConfig,
  pageSize = "A4",
}: UseCanvasDrawingProps): void {
  const { convertAnnotationToDrawingElement, drawSingleElement } =
    useDrawingRenderer()

  // ドラッグ状態を同期的に追跡するref
  const isDraggingRef = useRef(isDraggingElement ?? false)
  const prevIsDraggingForRedrawRef = useRef(isDraggingElement ?? false)

  useLayoutEffect(() => {
    isDraggingRef.current = isDraggingElement ?? false
  }, [isDraggingElement])

  // 設問変更時にSVGキャッシュをクリア
  useEffect(() => {
    clearSvgCache()
    textBoundsCacheRef.current.clear()
  }, [currentCropRegionId, textBoundsCacheRef])

  // メインキャンバス描画
  const drawCanvas = useCallback(
    async (images: HTMLImageElement[]) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      if (images.length === 0) return

      const firstImage = images[0]
      const canvasWidth = firstImage.naturalWidth
      const totalHeight = images.reduce(
        (total, image, index) =>
          total +
          image.naturalHeight +
          (index < images.length - 1 ? pageSpacing : 0),
        0
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

      // 複数ページ表示処理
      let currentY = 0
      images.forEach((image, index) => {
        const offsetX = (canvasWidth - image.naturalWidth) / 2
        const offsetY = currentY

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

        currentY += image.naturalHeight + (images.length > 1 ? pageSpacing : 0)
      })

      // 透明度定数
      const CURRENT_OPACITY = 0.8
      const OTHER_OPACITY = 0.4

      // 採点領域の描画ヘルパー関数
      const drawCropRegionMark = (
        region: CropRegionWithExamPage,
        status: ScoringStatus,
        isCurrent: boolean,
        actualScore: number | null
      ) => {
        const regionPageNumber = region.examPage?.pageNumber || 1
        const regionPageIndex = regionPageNumber - 1

        if (regionPageIndex < 0 || regionPageIndex >= images.length) return

        const image = images[regionPageIndex]
        if (!image) return

        let pageOffsetY = 0
        for (let i = 0; i < regionPageIndex; i++) {
          pageOffsetY +=
            images[i].naturalHeight + (images.length > 1 ? pageSpacing : 0)
        }

        const offsetX = (canvasWidth - image.naturalWidth) / 2
        const offsetY = pageOffsetY

        const regionX = region.x * image.naturalWidth + offsetX
        const regionY = region.y * image.naturalHeight + offsetY
        const regionWidth = region.width * image.naturalWidth
        const regionHeight = region.height * image.naturalHeight

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
        ctx.strokeRect(regionX, regionY, regionWidth, regionHeight)

        const labelFontSize = Math.max(12, 14 / zoom)
        ctx.font = `${labelFontSize}px sans-serif`
        ctx.fillStyle = isCurrent ? "#22c55e" : "#9ca3af"
        ctx.fillText(region.label, regionX, regionY - 5)

        // 採点記号の描画（印字設定に基づく）
        const shouldShowMark = scoringMarkConfig
          ? (scoringMarkConfig.showMarkForStatus[
              status as keyof typeof scoringMarkConfig.showMarkForStatus
            ] ?? false)
          : status !== "unscored"

        if (shouldShowMark) {
          const markKey = getScoringMarkKey(status)
          const markImage = markKey
            ? scoringMarkImagesRef.current.get(markKey)
            : null

          if (markImage) {
            const markSize = scoringMarkConfig?.markSize ?? 50

            const markPos = scoringMarkConfig
              ? calculateMarkPosition(
                  regionX,
                  regionY,
                  regionWidth,
                  regionHeight,
                  markSize,
                  scoringMarkConfig.markPosition,
                  scoringMarkConfig.markOffsetX,
                  scoringMarkConfig.markOffsetY
                )
              : {
                  x: regionX + (regionWidth - markSize) / 2,
                  y: regionY + (regionHeight - markSize) / 2,
                }

            ctx.globalAlpha = opacity
            ctx.drawImage(markImage, markPos.x, markPos.y, markSize, markSize)
          }
        }

        // 点数テキストの描画（印字設定に基づく）
        const shouldShowScore = scoringMarkConfig
          ? (scoringMarkConfig.showScoreForStatus[
              status as keyof typeof scoringMarkConfig.showScoreForStatus
            ] ?? false)
          : false

        if (shouldShowScore && actualScore !== null) {
          ctx.save()
          // 印字設定からスコア表示設定を取得（設問ごとの点数は部分点設定を使用、
          // 旧データで未設定の場合はレガシーフィールドへフォールバック）
          const scoreConfig = scoringMarkConfig?.partialScore ?? {
            position: scoringMarkConfig?.scorePosition ?? "bottom-right",
            offsetX: scoringMarkConfig?.scoreOffsetX ?? 0,
            offsetY: scoringMarkConfig?.scoreOffsetY ?? 0,
            size: scoringMarkConfig?.scoreSize ?? 14,
            alignment: scoringMarkConfig?.scoreAlignment ?? "center",
          }

          const fontSize = scoreConfig.size
          ctx.font = `bold ${fontSize}px sans-serif`
          ctx.fillStyle = "#ef4444" // 赤色
          ctx.globalAlpha = opacity
          ctx.textAlign = scoreConfig.alignment as CanvasTextAlign
          ctx.textBaseline = "middle"

          const scorePos = calculateScorePosition(
            regionX,
            regionY,
            regionWidth,
            regionHeight,
            scoreConfig.position as MarkPosition,
            scoreConfig.offsetX,
            scoreConfig.offsetY
          )
          ctx.fillText(String(actualScore), scorePos.x, scorePos.y)
          ctx.restore()
        }

        ctx.globalAlpha = 1.0
      }

      // 全設問の枠と採点記号・点数を描画
      if (images.length > 0) {
        // 他の設問を先に描画（半透明）
        for (const {
          cropRegion,
          status,
          actualScore,
        } of allCropRegionsWithStatus) {
          if (cropRegion.id === currentCropRegion?.id) continue
          drawCropRegionMark(cropRegion, status, false, actualScore)
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
            currentCropRegion,
            currentStatus,
            true,
            currentRegionData?.actualScore ?? null
          )
        }
      }

      // ページオフセット計算ヘルパー
      const calcPageOffset = (pageIndex: number): number => {
        let offset = 0
        for (let i = 0; i < pageIndex && i < images.length; i++) {
          offset +=
            images[i].naturalHeight + (images.length > 1 ? pageSpacing : 0)
        }
        return offset
      }

      // cropRegionId → pageIndex のルックアップマップ
      const cropRegionPageIndexMap = new Map<string, number>()
      for (const { cropRegion } of allCropRegionsWithStatus) {
        const pageNum = cropRegion.examPage?.pageNumber || 1
        cropRegionPageIndexMap.set(
          cropRegion.id,
          Math.min(pageNum - 1, images.length - 1)
        )
      }

      // 描画要素の描画
      if (images.length > 0) {
        // 現在設問のページオフセットを計算
        const currentPageNumber = currentCropRegion?.examPage?.pageNumber || 1
        const currentPageIndex = Math.min(
          currentPageNumber - 1,
          images.length - 1
        )
        const currentPageImg = images[currentPageIndex] || images[0]
        const currentOffsetX = (canvasWidth - currentPageImg.naturalWidth) / 2
        const currentOffsetY = calcPageOffset(currentPageIndex)

        const isAnyElementDragging =
          isDraggingRef.current && selectedElementIds.length > 0
        const isDragging =
          isDrawing || isAnyElementDragging || isDrawingSelection

        // 他設問のアノテーション（テキスト以外）
        if (!isDragging) {
          for (const annotation of allAnnotations) {
            if (
              annotation.questionScore?.cropRegionId === currentCropRegionId
            ) {
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
            const annotOffsetX = (canvasWidth - annotPageImg.naturalWidth) / 2
            const annotOffsetY = calcPageOffset(annotPageIndex)

            const element = convertAnnotationToDrawingElement(annotation)
            ctx.globalAlpha = 0.5
            await drawSingleElement(
              ctx,
              element,
              annotPageImg,
              annotOffsetX,
              annotOffsetY,
              false,
              false,
              false,
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
          await drawSingleElement(
            ctx,
            element,
            currentPageImg,
            currentOffsetX,
            currentOffsetY,
            isSelected,
            false,
            true,
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
          const rectWidth =
            selectionRectangle.width * currentPageImg.naturalWidth
          const rectHeight =
            selectionRectangle.height * currentPageImg.naturalHeight

          ctx.strokeRect(rectX, rectY, rectWidth, rectHeight)

          ctx.fillStyle = "#2563eb"
          ctx.globalAlpha = 0.1
          ctx.fillRect(rectX, rectY, rectWidth, rectHeight)

          ctx.restore()
        }
      }
    },
    [
      canvasRef,
      pageSpacing,
      currentCropRegion,
      currentScoringData,
      zoom,
      drawingElements,
      selectedElementIds,
      isDrawing,
      isDrawingSelection,
      selectionRectangle,
      allAnnotations,
      currentCropRegionId,
      scoringMarkImagesRef,
      convertAnnotationToDrawingElement,
      drawSingleElement,
      allCropRegionsWithStatus,
      scoringMarkConfig,
      pageSize,
    ]
  )

  // オーバーレイキャンバス描画（ハンドル専用）
  const drawOverlay = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current
    const mainCanvas = canvasRef.current
    if (!overlayCanvas || !mainCanvas) return
    if (loadedImages.length === 0) return

    const ctx = overlayCanvas.getContext("2d")
    if (!ctx) return

    const baseImage = loadedImages[0]
    const canvasWidth = baseImage.naturalWidth
    const totalHeight = loadedImages.reduce(
      (total, image, index) =>
        total +
        image.naturalHeight +
        (index < loadedImages.length - 1 ? pageSpacing : 0),
      0
    )

    overlayCanvas.width = canvasWidth
    overlayCanvas.height = totalHeight

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

    // 現在設問のページオフセットを計算
    const currentPageNumber = currentCropRegion?.examPage?.pageNumber || 1
    const currentPageIndex = Math.min(
      currentPageNumber - 1,
      loadedImages.length - 1
    )
    const currentPageImg = loadedImages[currentPageIndex] || loadedImages[0]
    const offsetX = (canvasWidth - currentPageImg.naturalWidth) / 2
    let offsetY = 0
    for (let i = 0; i < currentPageIndex; i++) {
      offsetY +=
        loadedImages[i].naturalHeight +
        (loadedImages.length > 1 ? pageSpacing : 0)
    }

    // ハンドル描画ヘルパー関数
    const drawElementHandles = (
      element: DrawingElement,
      handleSize: number,
      halfHandle: number,
      fillColor: string,
      opacity: number = 1.0
    ) => {
      ctx.save()
      ctx.globalAlpha = opacity
      ctx.fillStyle = fillColor
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 2

      switch (element.type) {
        case "line":
          if (element.endX !== undefined && element.endY !== undefined) {
            ctx.fillStyle = opacity < 1.0 ? fillColor : "#22c55e"
            const startX = element.x * currentPageImg.naturalWidth + offsetX
            const startY = element.y * currentPageImg.naturalHeight + offsetY
            ctx.fillRect(
              startX - halfHandle,
              startY - halfHandle,
              handleSize,
              handleSize
            )
            ctx.strokeRect(
              startX - halfHandle,
              startY - halfHandle,
              handleSize,
              handleSize
            )

            ctx.fillStyle = opacity < 1.0 ? fillColor : "#ef4444"
            const endX = element.endX * currentPageImg.naturalWidth + offsetX
            const endY = element.endY * currentPageImg.naturalHeight + offsetY
            ctx.fillRect(
              endX - halfHandle,
              endY - halfHandle,
              handleSize,
              handleSize
            )
            ctx.strokeRect(
              endX - halfHandle,
              endY - halfHandle,
              handleSize,
              handleSize
            )
          }
          break
        case "rectangle":
        case "ellipse":
          if (element.width !== undefined && element.height !== undefined) {
            const x = element.x * currentPageImg.naturalWidth + offsetX
            const y = element.y * currentPageImg.naturalHeight + offsetY
            const w = element.width * currentPageImg.naturalWidth
            const h = element.height * currentPageImg.naturalHeight
            const corners = [
              { x, y },
              { x: x + w, y },
              { x, y: y + h },
              { x: x + w, y: y + h },
            ]
            corners.forEach((corner) => {
              ctx.fillRect(
                corner.x - halfHandle,
                corner.y - halfHandle,
                handleSize,
                handleSize
              )
              ctx.strokeRect(
                corner.x - halfHandle,
                corner.y - halfHandle,
                handleSize,
                handleSize
              )
            })
          }
          break
        case "text":
          if (element.text) {
            const textX = element.x * currentPageImg.naturalWidth + offsetX
            const textY = element.y * currentPageImg.naturalHeight + offsetY
            ctx.fillRect(
              textX - halfHandle,
              textY - halfHandle,
              handleSize,
              handleSize
            )
            ctx.strokeRect(
              textX - halfHandle,
              textY - halfHandle,
              handleSize,
              handleSize
            )
          }
          break
      }
      ctx.restore()
    }

    const baseHandleSize = 8
    const handleSize = baseHandleSize / zoom
    const halfHandle = handleSize / 2

    // ホバー中要素のハンドルを描画
    if (hoveredElementId && !selectedElementIds.includes(hoveredElementId)) {
      const hoveredElement = drawingElements.find(
        (element) => element.id === hoveredElementId
      )
      if (hoveredElement) {
        drawElementHandles(
          hoveredElement,
          handleSize,
          halfHandle,
          "#3b82f6",
          0.5
        )
      }
    }

    // 選択中要素のハンドルを描画
    if (selectedElementIds.length > 0) {
      selectedElementIds.forEach((id) => {
        const element = drawingElements.find(
          (candidateElement) => candidateElement.id === id
        )
        if (!element) return
        drawElementHandles(element, handleSize, halfHandle, "#3b82f6", 1.0)
      })
    }

    // テキスト要素のドラッグ中: 簡易表示
    if (isDraggingElement && selectedElementIds.length > 0) {
      selectedElementIds.forEach((id) => {
        const element = drawingElements.find(
          (candidateElement) => candidateElement.id === id
        )
        if (!element || element.type !== "text") return

        ctx.save()
        ctx.strokeStyle = element.color
        ctx.setLineDash([5, 5])
        ctx.lineWidth = 2
        ctx.globalAlpha = 0.7

        const anchorX = element.x * currentPageImg.naturalWidth + offsetX
        const anchorY = element.y * currentPageImg.naturalHeight + offsetY

        const boundingWidth = element.text
          ? Math.max(element.text.length * (element.fontSize || 16) * 0.6, 50)
          : 50
        const boundingHeight = Math.max((element.fontSize || 16) * 1.2, 20)

        const anchorDir = element.anchorDirection || "top-left"
        const textPos = getTextPositionFromAnchor(
          anchorX,
          anchorY,
          boundingWidth,
          boundingHeight,
          anchorDir
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
      })
    }
  }, [
    overlayCanvasRef,
    canvasRef,
    loadedImages,
    pageSpacing,
    zoom,
    hoveredElementId,
    selectedElementIds,
    drawingElements,
    isDraggingElement,
    currentCropRegion,
  ])

  // テキスト専用キャンバス描画
  const drawTextCanvas = useCallback(async () => {
    const textCanvas = textCanvasRef.current
    if (!textCanvas) return
    if (loadedImages.length === 0) return

    const ctx = textCanvas.getContext("2d")
    if (!ctx) return

    const baseImage = loadedImages[0]
    const canvasWidth = baseImage.naturalWidth
    const totalHeight = loadedImages.reduce(
      (total, image, index) =>
        total +
        image.naturalHeight +
        (index < loadedImages.length - 1 ? pageSpacing : 0),
      0
    )

    textCanvas.width = canvasWidth
    textCanvas.height = totalHeight

    ctx.clearRect(0, 0, textCanvas.width, textCanvas.height)

    textBoundsCacheRef.current.clear()

    // ページオフセット計算ヘルパー
    const calcTextPageOffset = (pageIndex: number): number => {
      let offset = 0
      for (let i = 0; i < pageIndex && i < loadedImages.length; i++) {
        offset +=
          loadedImages[i].naturalHeight +
          (loadedImages.length > 1 ? pageSpacing : 0)
      }
      return offset
    }

    // cropRegionId → pageIndex ルックアップマップ
    const textCropRegionPageMap = new Map<string, number>()
    for (const { cropRegion } of allCropRegionsWithStatus) {
      const pageNum = cropRegion.examPage?.pageNumber || 1
      textCropRegionPageMap.set(
        cropRegion.id,
        Math.min(pageNum - 1, loadedImages.length - 1)
      )
    }

    // 現在設問のページ情報
    const currentPageNumber = currentCropRegion?.examPage?.pageNumber || 1
    const currentPageIndex = Math.min(
      currentPageNumber - 1,
      loadedImages.length - 1
    )
    const currentPageImg = loadedImages[currentPageIndex] || loadedImages[0]
    const currentPageHeight = currentPageImg.naturalHeight
    const currentPageOffsetY = calcTextPageOffset(currentPageIndex)

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

        let element: DrawingElement
        if (isCurrentQuestion) {
          const localElement = drawingElementsMap.get(annotation.id)
          if (localElement) {
            element = localElement
          } else {
            // drawingElementsに存在しない = ローカルで削除済み → 描画スキップ
            return null
          }
        } else {
          element = convertAnnotationToDrawingElement(annotation)
        }

        const isSelected =
          isCurrentQuestion && selectedElementIds.includes(element.id)

        // アノテーションが属するページを特定
        const annotCropRegionId = annotation.questionScore?.cropRegionId || ""
        const annotPageIndex = textCropRegionPageMap.get(annotCropRegionId) ?? 0
        const annotPageImg = loadedImages[annotPageIndex] || loadedImages[0]
        const annotPageHeight = annotPageImg.naturalHeight
        const annotPageOffsetY = calcTextPageOffset(annotPageIndex)

        try {
          // ページオフセット分だけコンテキストを平行移動して描画
          ctx.save()
          ctx.translate(0, annotPageOffsetY)
          const fontSizePx = mmToPixels(
            element.fontSize || 4.0,
            pageSize,
            canvasWidth,
            annotPageHeight
          )
          const pxElement = { ...element, fontSize: fontSizePx }
          const result = await renderTextElementV4(
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
        textBoundsCacheRef.current.set(item.element.id, {
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
              element.fontSize || 4.0,
              pageSize,
              canvasWidth,
              currentPageHeight
            )
            const pxElement = { ...element, fontSize: fontSizePx }
            const result = await renderTextElementV4(
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
          textBoundsCacheRef.current.set(item.element.id, {
            x: item.result.textBounds.x / canvasWidth,
            y: item.result.textBounds.y / currentPageHeight,
            width: item.result.textBounds.width / canvasWidth,
            height: item.result.textBounds.height / currentPageHeight,
          })
        }
      }
    }
  }, [
    textCanvasRef,
    loadedImages,
    pageSpacing,
    drawingElements,
    selectedElementIds,
    allAnnotations,
    currentCropRegionId,
    currentCropRegion,
    allCropRegionsWithStatus,
    textBoundsCacheRef,
    convertAnnotationToDrawingElement,
    pageSize,
  ])

  // オーバーレイキャンバスの描画
  useEffect(() => {
    if (!imageLoaded || loadedImages.length === 0) return
    drawOverlay()
  }, [imageLoaded, loadedImages, drawOverlay])

  // テキストキャンバスの描画制御
  const prevTextDraggingRef = useRef(false)
  const wasTextDraggedRef = useRef(false)

  // テキストキャンバスの排他制御
  const isDrawingTextCanvasRef = useRef(false)
  const needsTextRedrawRef = useRef(false)

  // 最新のdrawTextCanvasをrefで保持（stale closure防止）
  // executeTextCanvasDrawのfinally内で再帰呼び出しする際、
  // 古いクロージャのdrawTextCanvasではなく最新版を使用する
  const latestDrawTextCanvasRef = useRef(drawTextCanvas)
  latestDrawTextCanvasRef.current = drawTextCanvas

  const executeTextCanvasDraw = useCallback(async () => {
    if (isDrawingTextCanvasRef.current) {
      needsTextRedrawRef.current = true
      return
    }

    isDrawingTextCanvasRef.current = true
    needsTextRedrawRef.current = false

    try {
      // refから最新のdrawTextCanvasを取得（stale closure防止）
      await latestDrawTextCanvasRef.current()
    } finally {
      isDrawingTextCanvasRef.current = false

      if (needsTextRedrawRef.current) {
        needsTextRedrawRef.current = false
        // 再帰呼び出しもrefを通じて最新版を使用するため、
        // 安定した参照（deps: []）のまま正しく動作する
        executeTextCanvasDraw()
      }
    }
  }, []) // deps不要: drawTextCanvasはrefから取得

  // テキストドラッグ終了時の再描画
  useEffect(() => {
    if (!imageLoaded || loadedImages.length === 0) return

    const isTextBeingDragged =
      (isDraggingElement ?? false) &&
      selectedElementIds.some((id) =>
        drawingElements.find(
          (element) => element.id === id && element.type === "text"
        )
      )

    if (isTextBeingDragged && !prevTextDraggingRef.current) {
      wasTextDraggedRef.current = true
    }

    if (!isDraggingElement && wasTextDraggedRef.current) {
      executeTextCanvasDraw()
      wasTextDraggedRef.current = false
    }

    prevTextDraggingRef.current = isTextBeingDragged
  }, [
    imageLoaded,
    loadedImages,
    executeTextCanvasDraw,
    isDraggingElement,
    selectedElementIds,
    drawingElements,
  ])

  // テキストキャンバスの描画
  useEffect(() => {
    if (!imageLoaded || loadedImages.length === 0) return
    if (isDraggingElement) return
    executeTextCanvasDraw()
  }, [
    imageLoaded,
    loadedImages,
    isDraggingElement,
    executeTextCanvasDraw,
    drawingElements,
    allAnnotations,
    currentCropRegionId,
  ])

  // 描画の排他制御
  const isDrawingCanvasRef = useRef(false)
  const needsRedrawRef = useRef(false)
  const latestDrawParamsRef = useRef<{
    imageLoaded: boolean
    loadedImages: HTMLImageElement[]
    drawCanvas: (images: HTMLImageElement[]) => Promise<void>
  } | null>(null)

  // Canvas再描画
  useEffect(() => {
    latestDrawParamsRef.current = { imageLoaded, loadedImages, drawCanvas }

    const executeRedraw = async () => {
      const params = latestDrawParamsRef.current
      if (!params || !params.imageLoaded || params.loadedImages.length === 0)
        return

      if (isDrawingCanvasRef.current) {
        needsRedrawRef.current = true
        return
      }

      isDrawingCanvasRef.current = true
      needsRedrawRef.current = false

      try {
        await params.drawCanvas(params.loadedImages)
      } finally {
        isDrawingCanvasRef.current = false

        if (needsRedrawRef.current) {
          needsRedrawRef.current = false
          executeRedraw()
        }
      }
    }
    executeRedraw()
  }, [imageLoaded, loadedImages, drawCanvas])

  // ドラッグ終了時にメインキャンバスを再描画
  useEffect(() => {
    const wasDragging = prevIsDraggingForRedrawRef.current
    const isDragging = isDraggingElement ?? false
    prevIsDraggingForRedrawRef.current = isDragging

    if (wasDragging && !isDragging && imageLoaded && loadedImages.length > 0) {
      drawCanvas(loadedImages)
    }
  }, [isDraggingElement, imageLoaded, loadedImages, drawCanvas])

  // コンテナリサイズの監視
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(async () => {
      if (imageLoaded && loadedImages.length > 0) {
        await drawCanvas(loadedImages)
      }
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [imageLoaded, loadedImages, drawCanvas, containerRef])
}
