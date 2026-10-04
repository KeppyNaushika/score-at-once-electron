/**
 * Canvas描画の配線フック
 * - 3枚のキャンバス（メイン・オーバーレイ・テキスト）をいつ描き直すか
 * - 描画の排他制御（描画中に来た依頼は、終わってから最新の状態で1回だけ描く）
 *
 * 各キャンバスに何を描くかは utils/ の drawMainCanvas・drawOverlayCanvas・
 * drawTextCanvas にある。
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from "react"

import type { SelectionRectangle } from "@/components/exams/07-score-at-once/ScoringIndividual/types"
import type { ScoringData } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type {
  AnnotationWithContext,
  DrawingAnnotation,
} from "@/types/drawingAnnotation.types"
import type { AnswerOverlaySettings } from "@/types/scoringOverlay.types"

import { clearSvgCache } from "../../utils/canvasTextRenderer"
import { drawMainCanvas } from "../../utils/drawMainCanvas"
import { drawOverlayCanvas } from "../../utils/drawOverlayCanvas"
import { drawTextCanvas } from "../../utils/drawTextCanvas"
import type { CropRegionWithStatus } from "./types"
import { useDrawingRenderer } from "./useDrawingRenderer"

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
  currentCropRegion?: QuestionAnswerRegionRow | null
  zoom: number
  drawingElements: DrawingAnnotation[]
  selectedElementIds: string[]
  isDrawing: boolean
  isDrawingSelection: boolean
  selectionRectangle: SelectionRectangle | null
  pageSpacing?: number
  isDraggingElement?: boolean
  allAnnotations?: AnnotationWithContext[]
  currentCropRegionId?: string | null
  hoveredElementId?: string | null
  allCropRegionsWithStatus?: CropRegionWithStatus[]
  scoringMarkConfig?: AnswerOverlaySettings | null
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
  const { drawSingleElement } = useDrawingRenderer()

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

      drawMainCanvas(canvas, images, {
        pageSpacing,
        zoom,
        pageSize,
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
        isElementDragging: isDraggingRef.current,
        scoringMarkConfig,
        scoringMarkImages: scoringMarkImagesRef.current,
        drawSingleElement,
      })
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

    drawOverlayCanvas(overlayCanvas, loadedImages, {
      pageSpacing,
      zoom,
      currentCropRegion,
      drawingElements,
      selectedElementIds,
      hoveredElementId,
      isDraggingElement,
    })
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
  const drawTextLayer = useCallback(async () => {
    const textCanvas = textCanvasRef.current
    if (!textCanvas) return
    if (loadedImages.length === 0) return

    await drawTextCanvas(textCanvas, loadedImages, {
      pageSpacing,
      pageSize,
      currentCropRegion,
      currentCropRegionId,
      allCropRegionsWithStatus,
      allAnnotations,
      drawingElements,
      selectedElementIds,
      textBoundsCache: textBoundsCacheRef.current,
    })
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

  // 最新のdrawTextLayerをrefで保持（stale closure防止）
  // executeTextCanvasDrawのfinally内で再帰呼び出しする際、
  // 古いクロージャのdrawTextLayerではなく最新版を使用する
  const latestDrawTextLayerRef = useRef(drawTextLayer)
  useEffect(() => {
    latestDrawTextLayerRef.current = drawTextLayer
  })

  const executeTextCanvasDraw = useCallback(async () => {
    if (isDrawingTextCanvasRef.current) {
      needsTextRedrawRef.current = true
      return
    }

    isDrawingTextCanvasRef.current = true
    needsTextRedrawRef.current = false

    try {
      // refから最新のdrawTextLayerを取得（stale closure防止）
      await latestDrawTextLayerRef.current()
    } finally {
      isDrawingTextCanvasRef.current = false

      if (needsTextRedrawRef.current) {
        needsTextRedrawRef.current = false
        // 再帰呼び出しもrefを通じて最新版を使用するため、
        // 安定した参照（deps: []）のまま正しく動作する
        executeTextCanvasDraw()
      }
    }
  }, []) // deps不要: drawTextLayerはrefから取得

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
