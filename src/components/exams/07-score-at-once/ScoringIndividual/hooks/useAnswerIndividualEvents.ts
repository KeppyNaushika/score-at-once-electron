import { useCallback } from "react"

import type {
  DrawingElement,
  DrawingTool,
  LineEditMode,
  LineStyle,
  RectangleEditMode,
  SelectionRectangle,
} from "@/components/exams/07-score-at-once/ScoringIndividual/types/answerIndividualTypes"

import { useCanvasInteraction } from "./interaction/useCanvasInteraction"
import { useHandTool } from "./interaction/useHandTool"
import { useKeyboard } from "./interaction/useKeyboard"
import { useWheelZoom } from "./navigation/useWheelZoom"
import { useCoordinates } from "./utils/useCoordinates"
import { useEditModeUtils } from "./utils/useEditMode"
import { useHitTestUtils } from "./utils/useHitTest"

interface UseAnswerDisplayEventsProps {
  // Canvas and container refs
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>

  // Display state
  zoom: number
  position: { x: number; y: number }
  onZoomChange: (zoom: number) => void
  onPositionChange: (position: { x: number; y: number }) => void
  imageLoaded: boolean
  // 複数ページ対応
  loadedImages?: HTMLImageElement[]
  pageSpacing?: number

  // Drawing state
  currentTool: DrawingTool
  drawingElements: DrawingElement[]
  selectedElementIds: string[]
  isDraggingElement: boolean
  isDrawing: boolean
  currentDrawing: Partial<DrawingElement> | null
  strokeColor: string
  strokeWidth: number
  lineStyle: LineStyle
  isShiftPressed: boolean
  isCtrlPressed: boolean
  dragElementOffset: { x: number; y: number }
  isDrawingSelection: boolean
  selectionRectangle: SelectionRectangle | null
  lineEditMode: LineEditMode
  rectangleEditMode: RectangleEditMode
  // テキスト編集モーダル表示中フラグ（キーボードショートカット無効化用）
  isTextEditing: boolean
  // V4統合: テキストアンカー処理
  onTextAnchorClick?: (position: { x: number; y: number }) => void
  isDraggingHandle: boolean
  currentHandle: string | null
  hoveredElementId: string | null

  // テキスト境界キャッシュ（ヒットテスト用）
  textBoundsCache?: Map<
    string,
    { x: number; y: number; width: number; height: number }
  >

  // Drawing actions
  setSelectedElementIds: (ids: string[]) => void
  addToSelection: (id: string) => void
  removeFromSelection: (id: string) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  setIsDrawingSelection: (drawing: boolean) => void
  setSelectionRectangle: (
    rect:
      | SelectionRectangle
      | null
      | ((prev: SelectionRectangle | null) => SelectionRectangle | null)
  ) => void
  selectElementsInRectangle: (rect: SelectionRectangle) => void
  setIsDraggingElement: (dragging: boolean) => void
  setIsDrawing: (drawing: boolean) => void
  setCurrentDrawing: (
    drawing:
      | Partial<DrawingElement>
      | null
      | ((
          prev: Partial<DrawingElement> | null
        ) => Partial<DrawingElement> | null)
  ) => void
  setDragElementOffset: (offset: { x: number; y: number }) => void
  setLineEditMode: (mode: LineEditMode) => void
  setRectangleEditMode: (mode: RectangleEditMode) => void
  setIsShiftPressed: (pressed: boolean) => void
  setIsCtrlPressed: (pressed: boolean) => void
  setIsDraggingHandle: (dragging: boolean) => void
  setCurrentHandle: (handle: string | null) => void
  setHoveredElementId: (id: string | null) => void
  setDrawingElements: (
    elements: DrawingElement[] | ((prev: DrawingElement[]) => DrawingElement[])
  ) => void
  addDrawingElement: (element: DrawingElement) => void
  updateDrawingElement: (id: string, updates: Partial<DrawingElement>) => void
  removeDrawingElement: (id: string) => void

  // テキスト再編集
  onTextElementReClick?: (element: DrawingElement) => void

  // 画像アスペクト比（Shift制約用）
  imageAspectRatio?: number
}

/** 個別採点キャンバスのポインタイベントを各ツール（選択・描画・ハンド）に振り分けるフック */
export function useAnswerIndividualEvents(props: UseAnswerDisplayEventsProps) {
  const { canvasRef, containerRef, imageRef, zoom, onZoomChange, imageLoaded } =
    props

  // Initialize hit test utilities（ズームを渡して画面上の当たり判定サイズを一定に）
  const { hitTestElement, hitTestHandle } = useHitTestUtils({
    zoom,
    textBoundsCache: props.textBoundsCache,
  })

  // Initialize edit mode utilities
  const { getLineEditMode, getRectangleEditMode } = useEditModeUtils()

  // Initialize coordinate utilities
  const { getImageCoordinatesFromEvent, getScreenCoordinatesFromEvent } =
    useCoordinates({
      canvasRef,
      imageRef,
      zoom,
      loadedImages: props.loadedImages,
      pageSpacing: props.pageSpacing,
    })

  // Initialize wheel zoom handling
  useWheelZoom({
    containerRef,
    zoom,
    onZoomChange,
  })

  // Initialize keyboard handlers
  useKeyboard({
    selectedElementIds: props.selectedElementIds,
    isTextEditing: props.isTextEditing,
    setIsShiftPressed: props.setIsShiftPressed,
    setIsCtrlPressed: props.setIsCtrlPressed,
    removeDrawingElement: props.removeDrawingElement,
  })

  // Initialize tool-specific handlers
  const {
    handleHandToolMouseDown,
    handleHandToolMouseMove,
    handleHandToolMouseUp,
  } = useHandTool({
    containerRef,
    currentTool: props.currentTool,
    isDraggingElement: props.isDraggingElement,
    dragElementOffset: props.dragElementOffset,
    setIsDraggingElement: props.setIsDraggingElement,
    setDragElementOffset: props.setDragElementOffset,
  })

  // 統合されたキャンバスインタラクション
  const {
    handleSelectionMouseDown,
    handleSelectionMouseMove,
    handleSelectionMouseUp,
    handleNewDrawingMouseDown,
    handleNewDrawingMouseMove,
    handleNewDrawingMouseUp,
  } = useCanvasInteraction({
    canvasRef,
    currentTool: props.currentTool,
    drawingElements: props.drawingElements,
    selectedElementIds: props.selectedElementIds,
    isDraggingElement: props.isDraggingElement,
    isDrawing: props.isDrawing,
    currentDrawing: props.currentDrawing,
    isDrawingSelection: props.isDrawingSelection,
    selectionRectangle: props.selectionRectangle,
    isShiftPressed: props.isShiftPressed,
    isCtrlPressed: props.isCtrlPressed,
    strokeColor: props.strokeColor,
    strokeWidth: props.strokeWidth,
    lineStyle: props.lineStyle,
    lineEditMode: props.lineEditMode,
    rectangleEditMode: props.rectangleEditMode,
    setSelectedElementIds: props.setSelectedElementIds,
    toggleSelection: props.toggleSelection,
    clearSelection: props.clearSelection,
    setIsDrawingSelection: props.setIsDrawingSelection,
    setSelectionRectangle: props.setSelectionRectangle,
    selectElementsInRectangle: props.selectElementsInRectangle,
    setIsDrawing: props.setIsDrawing,
    setCurrentDrawing: props.setCurrentDrawing,
    setIsDraggingElement: props.setIsDraggingElement,
    setDragElementOffset: props.setDragElementOffset,
    setLineEditMode: props.setLineEditMode,
    setRectangleEditMode: props.setRectangleEditMode,
    setDrawingElements: props.setDrawingElements,
    addDrawingElement: props.addDrawingElement,
    updateDrawingElement: props.updateDrawingElement,
    removeDrawingElement: props.removeDrawingElement,
    hitTestElement,
    hitTestHandle,
    getLineEditMode,
    getRectangleEditMode,
    onTextAnchorClick: props.onTextAnchorClick,
    onTextElementReClick: props.onTextElementReClick,
    setHoveredElementId: props.setHoveredElementId,
    imageAspectRatio: props.imageAspectRatio,
  })

  // Main pointer event handlers that delegate to appropriate tool handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!imageLoaded) return

      const imageCoords = getImageCoordinatesFromEvent(e)
      if (!imageCoords) return

      // Delegate to appropriate handler based on current tool
      if (props.currentTool === "hand") {
        const screenCoords = getScreenCoordinatesFromEvent(e)
        handleHandToolMouseDown(screenCoords)
      } else if (props.currentTool === "select") {
        if (handleSelectionMouseDown(imageCoords, e.nativeEvent)) return
      } else {
        handleNewDrawingMouseDown(imageCoords)
      }
    },
    [
      imageLoaded,
      getImageCoordinatesFromEvent,
      getScreenCoordinatesFromEvent,
      props.currentTool,
      handleHandToolMouseDown,
      handleSelectionMouseDown,
      handleNewDrawingMouseDown,
    ]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!imageLoaded) return

      const imageCoords = getImageCoordinatesFromEvent(e)
      if (!imageCoords) return

      // Delegate to appropriate handler based on current tool and state
      if (props.currentTool === "select") {
        // 選択ツールでの操作（要素移動・選択範囲ドラッグ）
        if (handleSelectionMouseMove(imageCoords)) return
      } else if (props.currentTool === "hand" && props.isDraggingElement) {
        // handツールでのドラッグ（パン操作）
        handleHandToolMouseMove(e)
      } else {
        // 描画ツールでの操作
        handleNewDrawingMouseMove(imageCoords)
      }
    },
    [
      imageLoaded,
      getImageCoordinatesFromEvent,
      props.isDraggingElement,
      props.currentTool,
      handleHandToolMouseMove,
      handleSelectionMouseMove,
      handleNewDrawingMouseMove,
    ]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      // Call all handlers - they will check their own conditions
      handleHandToolMouseUp()
      handleSelectionMouseUp(e.nativeEvent)
      handleNewDrawingMouseUp()
    },
    [handleHandToolMouseUp, handleSelectionMouseUp, handleNewDrawingMouseUp]
  )

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }
}
