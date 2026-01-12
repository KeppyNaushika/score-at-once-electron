/**
 * Canvas描画ロジック統合フック
 * - メインキャンバス描画
 * - オーバーレイキャンバス描画（ハンドル）
 * - テキストキャンバス描画
 * - 描画の排他制御
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from "react"

import { getTextPositionFromAnchor } from "@/app/textbox-on-canvas-v4/utils/canvasUtils"
import type {
  DrawingElement,
  SelectionRectangle,
} from "@/components/projects/07-score-at-once/ScoringIndividual/types/answerIndividualTypes"
import type {
  CropRegionWithProjectPage,
  ScoringData,
} from "@/components/projects/07-score-at-once/types"
import type { DrawingAnnotationWithQuestionScore } from "@/types/drawingAnnotation.types"

import {
  clearSvgCache,
  renderTextElementV4,
} from "../../utils/canvasTextRendererV4"
import { useDrawingRenderer } from "./useDrawingRenderer"
import { getScoringMarkKey } from "./useScoringMarks"

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
  currentCropRegion?: CropRegionWithProjectPage | null
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

      const firstImg = images[0]
      const canvasWidth = firstImg.naturalWidth
      const totalHeight = images.reduce(
        (total, img, index) =>
          total +
          img.naturalHeight +
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
      images.forEach((img, index) => {
        const offsetX = (canvasWidth - img.naturalWidth) / 2
        const offsetY = currentY

        ctx.drawImage(img, offsetX, offsetY)

        if (images.length > 1 && index < images.length - 1) {
          ctx.strokeStyle = "#e5e7eb"
          ctx.lineWidth = 1
          ctx.setLineDash([5, 5])
          const borderY = offsetY + img.naturalHeight + pageSpacing / 2
          ctx.beginPath()
          ctx.moveTo(0, borderY)
          ctx.lineTo(canvas.width, borderY)
          ctx.stroke()
          ctx.setLineDash([])
        }

        currentY += img.naturalHeight + (images.length > 1 ? pageSpacing : 0)
      })

      // 設問枠描画
      if (currentCropRegion && images.length > 0) {
        const questionPageNumber =
          currentCropRegion.projectPage?.pageNumber || 1
        const questionPageIndex = questionPageNumber - 1

        if (questionPageIndex >= 0 && questionPageIndex < images.length) {
          const img = images[questionPageIndex]

          if (img) {
            let pageOffsetY = 0
            for (let i = 0; i < questionPageIndex; i++) {
              pageOffsetY +=
                images[i].naturalHeight + (images.length > 1 ? pageSpacing : 0)
            }

            const offsetX = (canvasWidth - img.naturalWidth) / 2
            const offsetY = pageOffsetY

            const questionX = currentCropRegion.x * img.naturalWidth + offsetX
            const questionY = currentCropRegion.y * img.naturalHeight + offsetY
            const questionWidth = currentCropRegion.width * img.naturalWidth
            const questionHeight = currentCropRegion.height * img.naturalHeight

            ctx.strokeStyle = "#22c55e"
            ctx.lineWidth = 2
            ctx.setLineDash([])
            ctx.strokeRect(questionX, questionY, questionWidth, questionHeight)

            ctx.fillStyle = "#22c55e"
            const labelFontSize = Math.max(12, 14 / zoom)
            ctx.font = `${labelFontSize}px sans-serif`
            ctx.fillText(currentCropRegion.label, questionX, questionY - 5)

            // 採点記号の描画
            if (
              currentScoringData &&
              currentScoringData.status !== "unscored"
            ) {
              const markKey = getScoringMarkKey(currentScoringData.status)
              const markImage = markKey
                ? scoringMarkImagesRef.current.get(markKey)
                : null

              if (markImage) {
                const markSize = Math.min(questionHeight * 0.5, 100)
                const markX = questionX + (questionWidth - markSize) / 2
                const markY = questionY + (questionHeight - markSize) / 2
                ctx.drawImage(markImage, markX, markY, markSize, markSize)
              }
            }
          }
        }
      }

      // 描画要素の描画
      if (images.length > 0) {
        const baseImg = images[0]
        if (baseImg) {
          const offsetX = (canvasWidth - baseImg.naturalWidth) / 2
          const offsetY = 0

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
              const element = convertAnnotationToDrawingElement(annotation)
              ctx.globalAlpha = 0.5
              await drawSingleElement(
                ctx,
                element,
                baseImg,
                offsetX,
                offsetY,
                false,
                false,
                false
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
              baseImg,
              offsetX,
              offsetY,
              isSelected,
              false
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

            const rectX = selectionRectangle.x * baseImg.naturalWidth + offsetX
            const rectY = selectionRectangle.y * baseImg.naturalHeight + offsetY
            const rectWidth = selectionRectangle.width * baseImg.naturalWidth
            const rectHeight = selectionRectangle.height * baseImg.naturalHeight

            ctx.strokeRect(rectX, rectY, rectWidth, rectHeight)

            ctx.fillStyle = "#2563eb"
            ctx.globalAlpha = 0.1
            ctx.fillRect(rectX, rectY, rectWidth, rectHeight)

            ctx.restore()
          }
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

    const baseImg = loadedImages[0]
    const canvasWidth = baseImg.naturalWidth
    const totalHeight = loadedImages.reduce(
      (total, img, index) =>
        total +
        img.naturalHeight +
        (index < loadedImages.length - 1 ? pageSpacing : 0),
      0
    )

    overlayCanvas.width = canvasWidth
    overlayCanvas.height = totalHeight

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

    const offsetX = (canvasWidth - baseImg.naturalWidth) / 2
    const offsetY = 0

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
            const startX = element.x * baseImg.naturalWidth + offsetX
            const startY = element.y * baseImg.naturalHeight + offsetY
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
            const endX = element.endX * baseImg.naturalWidth + offsetX
            const endY = element.endY * baseImg.naturalHeight + offsetY
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
            const x = element.x * baseImg.naturalWidth + offsetX
            const y = element.y * baseImg.naturalHeight + offsetY
            const w = element.width * baseImg.naturalWidth
            const h = element.height * baseImg.naturalHeight
            const corners = [
              { x, y },
              { x: x + w, y },
              { x, y: y + h },
              { x: x + w, y: y + h },
            ]
            corners.forEach((c) => {
              ctx.fillRect(
                c.x - halfHandle,
                c.y - halfHandle,
                handleSize,
                handleSize
              )
              ctx.strokeRect(
                c.x - halfHandle,
                c.y - halfHandle,
                handleSize,
                handleSize
              )
            })
          }
          break
        case "text":
          if (element.text) {
            const textX = element.x * baseImg.naturalWidth + offsetX
            const textY = element.y * baseImg.naturalHeight + offsetY
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
        (el) => el.id === hoveredElementId
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
        const element = drawingElements.find((el) => el.id === id)
        if (!element) return
        drawElementHandles(element, handleSize, halfHandle, "#3b82f6", 1.0)
      })
    }

    // テキスト要素のドラッグ中: 簡易表示
    if (isDraggingElement && selectedElementIds.length > 0) {
      selectedElementIds.forEach((id) => {
        const element = drawingElements.find((el) => el.id === id)
        if (!element || element.type !== "text") return

        ctx.save()
        ctx.strokeStyle = element.color
        ctx.setLineDash([5, 5])
        ctx.lineWidth = 2
        ctx.globalAlpha = 0.7

        const anchorX = element.x * baseImg.naturalWidth + offsetX
        const anchorY = element.y * baseImg.naturalHeight + offsetY

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
  ])

  // テキスト専用キャンバス描画
  const drawTextCanvas = useCallback(async () => {
    const textCanvas = textCanvasRef.current
    if (!textCanvas) return
    if (loadedImages.length === 0) return

    const ctx = textCanvas.getContext("2d")
    if (!ctx) return

    const baseImg = loadedImages[0]
    const canvasWidth = baseImg.naturalWidth
    const canvasHeight = baseImg.naturalHeight
    const totalHeight = loadedImages.reduce(
      (total, img, index) =>
        total +
        img.naturalHeight +
        (index < loadedImages.length - 1 ? pageSpacing : 0),
      0
    )

    textCanvas.width = canvasWidth
    textCanvas.height = totalHeight

    ctx.clearRect(0, 0, textCanvas.width, textCanvas.height)

    textBoundsCacheRef.current.clear()

    const drawingElementsMap = new Map(drawingElements.map((el) => [el.id, el]))

    // 全テキストをallAnnotationsから描画
    const textAnnotations = allAnnotations.filter(
      (a) => a.type === "text" && a.text
    )
    const drawnIds = new Set(textAnnotations.map((a) => a.id))

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
            element = convertAnnotationToDrawingElement(annotation)
          }
        } else {
          element = convertAnnotationToDrawingElement(annotation)
        }

        const isSelected =
          isCurrentQuestion && selectedElementIds.includes(element.id)

        try {
          const result = await renderTextElementV4(
            ctx,
            element,
            canvasWidth,
            canvasHeight,
            isSelected,
            isCurrentQuestion,
            isCurrentQuestion ? 1.0 : 0.3
          )
          return { element, result, isCurrentQuestion }
        } catch {
          return null
        }
      })
    )

    // 現在設問のテキストをキャッシュ
    for (const item of annotationResults) {
      if (item && item.isCurrentQuestion && item.result.success) {
        textBoundsCacheRef.current.set(item.element.id, {
          x: item.result.textBounds.x / canvasWidth,
          y: item.result.textBounds.y / canvasHeight,
          width: item.result.textBounds.width / canvasWidth,
          height: item.result.textBounds.height / canvasHeight,
        })
      }
    }

    // 新規作成直後の要素
    const newTextElements = drawingElements.filter(
      (el) => el.type === "text" && el.text && !drawnIds.has(el.id)
    )

    if (newTextElements.length > 0) {
      const newResults = await Promise.all(
        newTextElements.map(async (element) => {
          const isSelected = selectedElementIds.includes(element.id)
          try {
            const result = await renderTextElementV4(
              ctx,
              element,
              canvasWidth,
              canvasHeight,
              isSelected,
              true,
              1.0
            )
            return { element, result }
          } catch {
            return null
          }
        })
      )

      for (const item of newResults) {
        if (item && item.result.success) {
          textBoundsCacheRef.current.set(item.element.id, {
            x: item.result.textBounds.x / canvasWidth,
            y: item.result.textBounds.y / canvasHeight,
            width: item.result.textBounds.width / canvasWidth,
            height: item.result.textBounds.height / canvasHeight,
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
    textBoundsCacheRef,
    convertAnnotationToDrawingElement,
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

  const executeTextCanvasDraw = useCallback(async () => {
    if (isDrawingTextCanvasRef.current) {
      needsTextRedrawRef.current = true
      return
    }

    isDrawingTextCanvasRef.current = true
    needsTextRedrawRef.current = false

    try {
      await drawTextCanvas()
    } finally {
      isDrawingTextCanvasRef.current = false

      if (needsTextRedrawRef.current) {
        needsTextRedrawRef.current = false
        executeTextCanvasDraw()
      }
    }
  }, [drawTextCanvas])

  // テキストドラッグ終了時の再描画
  useEffect(() => {
    if (!imageLoaded || loadedImages.length === 0) return

    const isTextBeingDragged =
      (isDraggingElement ?? false) &&
      selectedElementIds.some((id) =>
        drawingElements.find((el) => el.id === id && el.type === "text")
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
