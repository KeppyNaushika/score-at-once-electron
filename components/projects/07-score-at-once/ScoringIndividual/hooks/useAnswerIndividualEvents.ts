import { useCoordinateUtils } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useCoordinateUtils"
import { useDrawingHandlers } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useDrawingHandlers"
import { useDrawingUtils } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useDrawingUtils"
import { useHandToolHandlers } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useHandToolHandlers"
import { useKeyboardHandlers } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useKeyboardHandlers"
import { useSelectionHandlers } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useSelectionHandlers"
import { useWheelZoom } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useWheelZoom"
import type { DrawingTool } from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import { useCallback } from "react"

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

  // Drawing state
  currentTool: DrawingTool
  drawingElements: any[]
  selectedElementIds: string[]
  isDraggingElement: boolean
  isDrawing: boolean
  currentDrawing: any
  strokeColor: string
  strokeWidth: number
  lineStyle: any
  isShiftPressed: boolean
  isCtrlPressed: boolean
  dragElementOffset: { x: number; y: number }
  isDrawingSelection: boolean
  selectionRectangle: any
  lineEditMode: any
  rectangleEditMode: any
  isCreatingTextBox: boolean
  showTextInput: boolean
  textInputPosition: { x: number; y: number }
  textInputValue: string
  isDraggingHandle: boolean
  currentHandle: string | null

  // Drawing actions
  setSelectedElementIds: (ids: string[]) => void
  addToSelection: (id: string) => void
  removeFromSelection: (id: string) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  setIsDrawingSelection: (drawing: boolean) => void
  setSelectionRectangle: (rect: any) => void
  selectElementsInRectangle: (rect: any) => void
  setIsDraggingElement: (dragging: boolean) => void
  setIsDrawing: (drawing: boolean) => void
  setCurrentDrawing: (drawing: any) => void
  setDragElementOffset: (offset: { x: number; y: number }) => void
  setLineEditMode: (mode: any) => void
  setRectangleEditMode: (mode: any) => void
  setIsCreatingTextBox: (creating: boolean) => void
  setShowTextInput: (show: boolean) => void
  setTextInputPosition: (position: { x: number; y: number }) => void
  setTextInputValue: (value: string) => void
  setIsShiftPressed: (pressed: boolean) => void
  setIsCtrlPressed: (pressed: boolean) => void
  setIsDraggingHandle: (dragging: boolean) => void
  setCurrentHandle: (handle: string | null) => void
  addDrawingElement: (element: any) => void
  updateDrawingElement: (id: string, updates: any) => void
  removeDrawingElement: (id: string) => void

  // テキスト再編集
  onTextElementReClick?: (element: any) => void
}

export function useAnswerIndividualEvents(props: UseAnswerDisplayEventsProps) {
  const { canvasRef, containerRef, imageRef, zoom, onZoomChange, imageLoaded } =
    props

  // Initialize drawing utilities
  const {
    hitTestElement,
    hitTestHandle,
    getLineEditMode,
    getRectangleEditMode,
  } = useDrawingUtils()

  // Initialize coordinate utilities
  const { getImageCoordinatesFromEvent, getScreenCoordinatesFromEvent } =
    useCoordinateUtils({
      canvasRef,
      imageRef,
      zoom,
    })

  // Initialize wheel zoom handling
  useWheelZoom({
    containerRef,
    zoom,
    onZoomChange,
  })

  // Initialize keyboard handlers
  useKeyboardHandlers({
    selectedElementIds: props.selectedElementIds,
    showTextInput: props.showTextInput,
    setIsShiftPressed: props.setIsShiftPressed,
    setIsCtrlPressed: props.setIsCtrlPressed,
    removeDrawingElement: props.removeDrawingElement,
  })

  // Initialize tool-specific handlers
  const {
    handleHandToolMouseDown,
    handleHandToolMouseMove,
    handleHandToolMouseUp,
  } = useHandToolHandlers({
    containerRef,
    currentTool: props.currentTool,
    isDraggingElement: props.isDraggingElement,
    dragElementOffset: props.dragElementOffset,
    setIsDraggingElement: props.setIsDraggingElement,
    setDragElementOffset: props.setDragElementOffset,
  })

  const {
    handleSelectionMouseDown,
    handleSelectionMouseMove,
    handleSelectionMouseUp,
  } = useSelectionHandlers({
    currentTool: props.currentTool,
    drawingElements: props.drawingElements,
    selectedElementIds: props.selectedElementIds,
    isDraggingElement: props.isDraggingElement,
    isDrawingSelection: props.isDrawingSelection,
    selectionRectangle: props.selectionRectangle,
    isCtrlPressed: props.isCtrlPressed,
    isShiftPressed: props.isShiftPressed,
    lineEditMode: props.lineEditMode,
    dragElementOffset: props.dragElementOffset,
    canvasRef, // Canvas ref for cursor management
    toggleSelection: props.toggleSelection,
    setSelectedElementIds: props.setSelectedElementIds,
    clearSelection: props.clearSelection,
    setIsDrawingSelection: props.setIsDrawingSelection,
    setSelectionRectangle: props.setSelectionRectangle,
    selectElementsInRectangle: props.selectElementsInRectangle,
    setIsDraggingElement: props.setIsDraggingElement,
    setDragElementOffset: props.setDragElementOffset,
    setLineEditMode: props.setLineEditMode,
    setRectangleEditMode: props.setRectangleEditMode,
    updateDrawingElement: props.updateDrawingElement,
    // Drawing utils
    hitTestElement,
    hitTestHandle,
    getLineEditMode,
    getRectangleEditMode,
    // テキスト再編集
    onTextElementReClick: props.onTextElementReClick,
  })

  const {
    handleDrawingMouseDown,
    handleDrawingMouseMove,
    handleDrawingMouseUp,
  } = useDrawingHandlers({
    currentTool: props.currentTool,
    isDrawing: props.isDrawing,
    currentDrawing: props.currentDrawing,
    isCreatingTextBox: props.isCreatingTextBox,
    isShiftPressed: props.isShiftPressed,
    strokeColor: props.strokeColor,
    strokeWidth: props.strokeWidth,
    lineStyle: props.lineStyle,
    setIsCreatingTextBox: props.setIsCreatingTextBox,
    setIsDrawing: props.setIsDrawing,
    setCurrentDrawing: props.setCurrentDrawing,
    addDrawingElement: props.addDrawingElement,
    canvasRef,
    containerRef,
    imageRef,
    zoom,
    setTextInputPosition: props.setTextInputPosition,
    setShowTextInput: props.setShowTextInput,
    setTextInputValue: props.setTextInputValue,
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
        handleDrawingMouseDown(imageCoords)
      }
    },
    [
      imageLoaded,
      getImageCoordinatesFromEvent,
      getScreenCoordinatesFromEvent,
      props.currentTool,
      handleHandToolMouseDown,
      handleSelectionMouseDown,
      handleDrawingMouseDown,
    ],
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
        handleDrawingMouseMove(imageCoords)
      }
    },
    [
      imageLoaded,
      getImageCoordinatesFromEvent,
      props.isDraggingElement,
      props.currentTool,
      handleHandToolMouseMove,
      handleSelectionMouseMove,
      handleDrawingMouseMove,
    ],
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Call all handlers - they will check their own conditions
    handleHandToolMouseUp()
    handleSelectionMouseUp(e.nativeEvent)
    handleDrawingMouseUp()
  }, [handleHandToolMouseUp, handleSelectionMouseUp, handleDrawingMouseUp])

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }
}
