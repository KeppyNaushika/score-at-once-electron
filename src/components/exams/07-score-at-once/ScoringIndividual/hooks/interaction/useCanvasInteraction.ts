/**
 * @fileoverview キャンバスインタラクションオーケストレーター
 * 選択・移動・リサイズ・新規描画を統合管理
 */
import { useCallback } from "react"

import { useCursor } from "@/components/exams/07-score-at-once/ScoringIndividual/hooks/utils/useCursor"
import type { SelectionRectangle } from "@/components/exams/07-score-at-once/ScoringIndividual/types"
import type {
  AnnotationTarget,
  DrawingAnnotation,
  LineStyle,
} from "@/types/drawingAnnotation.types"

import { findClosestHandleHit } from "../../utils/handleHit"
import { useDrawingCreation } from "./useDrawingCreation"
import { useElementMovement } from "./useElementMovement"
import { useElementResize } from "./useElementResize"
import { useElementSelection } from "./useElementSelection"
import { useIdleHoverCursor } from "./useIdleHoverCursor"
import { usePointerCapture } from "./usePointerCapture"
import { useRectangleSelection } from "./useRectangleSelection"
import { useResizeDrag } from "./useResizeDrag"

/** キャンバスインタラクションフックのプロパティ */
interface UseCanvasInteractionProps {
  /** キャンバス参照 */
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** 現在のツール */
  currentTool: string
  /** 注釈の行き先（答案＋設問＋採点者）。決まっていなければ新規描画を始めない */
  annotationTarget: AnnotationTarget | null
  /** 描画要素配列 */
  drawingElements: DrawingAnnotation[]
  /** 選択中の要素ID配列 */
  selectedElementIds: string[]
  /** 要素ドラッグ中フラグ */
  isDraggingElement: boolean
  /** 描画中フラグ */
  isDrawing: boolean
  /** 現在描画中の要素 */
  currentDrawing: Partial<DrawingAnnotation> | null
  /** 選択範囲ドラッグ中フラグ */
  isDrawingSelection: boolean
  /** 選択範囲矩形 */
  selectionRectangle: SelectionRectangle | null
  /** Shiftキー押下状態 */
  isShiftPressed: boolean
  /** Ctrlキー押下状態 */
  isCtrlPressed: boolean
  /** 線の色 */
  strokeColor: string
  /** 線の太さ */
  strokeWidth: number
  /** 線のスタイル */
  lineStyle: LineStyle
  /** 線編集モード */
  lineEditMode: "start" | "end" | "move" | null
  /** 矩形編集モード */
  rectangleEditMode: "resize" | "move" | null
  /** 画像のアスペクト比（width/height） */
  imageAspectRatio?: number

  // アクション
  setSelectedElementIds: (ids: string[]) => void
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
  setIsDrawing: (drawing: boolean) => void
  setCurrentDrawing: (
    drawing:
      | Partial<DrawingAnnotation>
      | null
      | ((
          prev: Partial<DrawingAnnotation> | null
        ) => Partial<DrawingAnnotation> | null)
  ) => void
  setIsDraggingElement: (dragging: boolean) => void
  setDragElementOffset: (offset: { x: number; y: number }) => void
  setLineEditMode: (mode: "start" | "end" | "move" | null) => void
  setRectangleEditMode: (mode: "resize" | "move" | null) => void
  setDrawingElements: (
    elements:
      DrawingAnnotation[] | ((prev: DrawingAnnotation[]) => DrawingAnnotation[])
  ) => void
  addDrawingElement: (element: DrawingAnnotation) => void
  updateDrawingElement: (
    id: string,
    updates: Partial<DrawingAnnotation>
  ) => void
  updateDrawingElements: (
    updates: Array<{ id: string; updates: Partial<DrawingAnnotation> }>
  ) => void
  removeDrawingElement: (id: string) => void

  // ユーティリティ
  hitTestElement: (element: DrawingAnnotation, x: number, y: number) => boolean
  hitTestHandle: (
    element: DrawingAnnotation,
    x: number,
    y: number
  ) => string | null
  getLineEditMode: (
    element: DrawingAnnotation,
    x: number,
    y: number
  ) => "start" | "end" | "move" | null
  getRectangleEditMode: (
    element: DrawingAnnotation,
    x: number,
    y: number
  ) => "resize" | "move" | null

  // コールバック
  onTextAnchorClick?: (position: { x: number; y: number }) => void
  onTextElementReClick?: (element: DrawingAnnotation) => void
  setHoveredElementId?: (id: string | null) => void
}

/** キャンバスインタラクションフックの戻り値 */
interface UseCanvasInteractionReturn {
  handleSelectionMouseDown: (
    imageCoords: { x: number; y: number },
    originalEvent?: PointerEvent | MouseEvent
  ) => boolean
  handleSelectionMouseMove: (imageCoords: { x: number; y: number }) => boolean
  handleSelectionMouseUp: (originalEvent?: PointerEvent | MouseEvent) => boolean
  handleNewDrawingMouseDown: (imageCoords: { x: number; y: number }) => boolean
  handleNewDrawingMouseMove: (imageCoords: { x: number; y: number }) => boolean
  handleNewDrawingMouseUp: () => boolean
}

/**
 * キャンバスインタラクションオーケストレーター
 *
 * @description
 * 以下の機能を統合管理する：
 * - 新規描画（線・矩形・楕円・テキスト）
 * - 要素選択（クリック・矩形選択）
 * - 要素移動
 * - 要素リサイズ
 * - カーソル管理
 *
 * @param props - フックのプロパティ
 * @returns インタラクションハンドラー
 */
export function useCanvasInteraction({
  canvasRef,
  currentTool,
  annotationTarget,
  drawingElements,
  selectedElementIds,
  isDraggingElement,
  isDrawing,
  isDrawingSelection,
  selectionRectangle,
  isShiftPressed,
  isCtrlPressed,
  strokeColor,
  strokeWidth,
  lineStyle,
  lineEditMode,
  imageAspectRatio = 1,
  setSelectedElementIds,
  toggleSelection,
  clearSelection,
  setIsDrawingSelection,
  setSelectionRectangle,
  selectElementsInRectangle,
  setIsDrawing,
  setIsDraggingElement,
  setDragElementOffset,
  setLineEditMode,
  setRectangleEditMode,
  setDrawingElements,
  addDrawingElement,
  updateDrawingElement,
  updateDrawingElements,
  hitTestElement,
  hitTestHandle,
  getLineEditMode,
  getRectangleEditMode,
  onTextAnchorClick,
  onTextElementReClick,
  setHoveredElementId,
}: UseCanvasInteractionProps): UseCanvasInteractionReturn {
  // カーソル管理
  const { setCursor, resetCursor, getResizeCursor } = useCursor({
    canvasRef,
    hitTestHandle,
  })

  // 掴んでいる間のポインターキャプチャ
  const { capturePointer, releasePointer } = usePointerCapture(canvasRef)

  // 新規描画
  const {
    handleNewDrawingMouseDown,
    handleNewDrawingMouseMove,
    handleNewDrawingMouseUp,
  } = useDrawingCreation({
    currentTool,
    annotationTarget,
    isDrawing,
    drawingElements,
    isShiftPressed,
    strokeColor,
    strokeWidth,
    lineStyle,
    imageAspectRatio,
    setIsDrawing,
    setDrawingElements,
    addDrawingElement,
    onTextAnchorClick,
  })

  // リサイズ
  const { getResizeHandle, handleElementResize } = useElementResize({
    isShiftPressed,
    imageAspectRatio,
    setDrawingElements,
    hitTestHandle,
  })
  const { isResizing, resizeHandle, startResize, resizeTo, finishResize } =
    useResizeDrag({
      drawingElements,
      handleElementResize,
      updateDrawingElement,
    })

  // 要素選択
  const { handleElementSelection } = useElementSelection({
    currentTool,
    drawingElements,
    selectedElementIds,
    isCtrlPressed,
    toggleSelection,
    setSelectedElementIds,
    setLineEditMode,
    setRectangleEditMode,
    hitTestElement,
    getLineEditMode,
    getRectangleEditMode,
    onTextElementReClick,
  })

  // 要素移動
  const {
    handleElementMovement,
    handleMovementEnd,
    initializeMoveStart,
    flushPendingMoves,
  } = useElementMovement({
    currentTool,
    drawingElements,
    selectedElementIds,
    isDraggingElement,
    lineEditMode,
    isShiftPressed,
    setIsDraggingElement,
    setDragElementOffset,
    setLineEditMode,
    setRectangleEditMode,
    setDrawingElements,
    updateDrawingElements,
    hitTestElement,
  })

  // 矩形選択
  const {
    startRectangleSelection,
    updateRectangleSelection,
    completeRectangleSelection,
  } = useRectangleSelection({
    currentTool,
    drawingElements,
    selectedElementIds,
    isDrawingSelection,
    selectionRectangle,
    isCtrlPressed,
    clearSelection,
    setIsDrawingSelection,
    setSelectionRectangle,
    selectElementsInRectangle,
    setSelectedElementIds,
    setLineEditMode,
    setRectangleEditMode,
  })

  // 何も掴んでいないときのホバー表示
  const updateIdleHoverCursor = useIdleHoverCursor({
    drawingElements,
    getLineEditMode,
    getResizeHandle,
    hitTestElement,
    setCursor,
    getResizeCursor,
    setHoveredElementId,
  })

  /**
   * 選択ツールのマウスダウンハンドラー
   */
  const handleSelectionMouseDown = useCallback(
    (
      imageCoords: { x: number; y: number },
      originalEvent?: PointerEvent | MouseEvent
    ): boolean => {
      if (currentTool !== "select") return false

      // 最も近いハンドルを選択
      const closest = findClosestHandleHit(drawingElements, imageCoords, {
        getLineEditMode,
        getResizeHandle,
      })
      if (closest) {
        if (!selectedElementIds.includes(closest.element.id)) {
          setSelectedElementIds([closest.element.id])
        }

        if (closest.type === "line-endpoint") {
          setLineEditMode(closest.handleName)
          setIsDraggingElement(true)
          setDragElementOffset({ x: 0, y: 0 })
          initializeMoveStart(imageCoords, [closest.element.id])
          capturePointer(originalEvent)
          setCursor(getResizeCursor(closest.element, closest.handleName))
        } else if (closest.type === "text-anchor") {
          setIsDraggingElement(true)
          setDragElementOffset({ x: 0, y: 0 })
          initializeMoveStart(imageCoords, [closest.element.id])
          capturePointer(originalEvent)
          setCursor("move")
        } else {
          // リサイズハンドル
          startResize(closest.element, closest.handleName)
          setIsDraggingElement(true)
          capturePointer(originalEvent)
          setCursor(getResizeCursor(closest.element, closest.handleName))
        }
        return true
      }

      // 要素選択を試みる
      const { elementSelected, clickedElement, clickedCoords } =
        handleElementSelection(imageCoords)

      if (!elementSelected) {
        setCursor("crosshair")
        startRectangleSelection(imageCoords)
      } else if (clickedElement && clickedCoords) {
        if (clickedElement.type === "text") {
          if (onTextElementReClick) {
            onTextElementReClick(clickedElement)
          }
          return true
        }

        setIsDraggingElement(true)
        const dragOffsetX = clickedCoords.x - clickedElement.x
        const dragOffsetY = clickedCoords.y - clickedElement.y
        setDragElementOffset({ x: dragOffsetX, y: dragOffsetY })

        const idsForMoveStart = selectedElementIds.includes(clickedElement.id)
          ? selectedElementIds
          : [clickedElement.id]
        initializeMoveStart(clickedCoords, idsForMoveStart)
        capturePointer(originalEvent)
      }

      return true
    },
    [
      currentTool,
      selectedElementIds,
      drawingElements,
      getResizeHandle,
      getLineEditMode,
      handleElementSelection,
      setCursor,
      getResizeCursor,
      startRectangleSelection,
      startResize,
      setIsDraggingElement,
      setDragElementOffset,
      setLineEditMode,
      setSelectedElementIds,
      capturePointer,
      initializeMoveStart,
      onTextElementReClick,
    ]
  )

  /**
   * 選択ツールのマウスムーブハンドラー
   */
  const handleSelectionMouseMove = useCallback(
    (imageCoords: { x: number; y: number }): boolean => {
      if (currentTool !== "select") {
        resetCursor()
        return false
      }

      // リサイズ操作
      if (resizeTo(imageCoords)) return true

      // カーソル更新
      if (isResizing) {
        setCursor(getResizeCursor(null, resizeHandle || ""))
      } else if (isDrawingSelection) {
        setCursor("crosshair")
      } else if (isDraggingElement) {
        if (lineEditMode === "start" || lineEditMode === "end") {
          const selectedElement = drawingElements.find((element) =>
            selectedElementIds.includes(element.id)
          )
          if (selectedElement) {
            setCursor(getResizeCursor(selectedElement, lineEditMode))
          }
        } else {
          setCursor("move")
        }
      } else {
        updateIdleHoverCursor(imageCoords)
      }

      // 要素移動
      if (handleElementMovement(imageCoords)) return true

      // 矩形選択更新
      if (updateRectangleSelection(imageCoords)) return true

      return false
    },
    [
      currentTool,
      resizeTo,
      isResizing,
      resizeHandle,
      drawingElements,
      selectedElementIds,
      isDrawingSelection,
      isDraggingElement,
      lineEditMode,
      handleElementMovement,
      updateRectangleSelection,
      updateIdleHoverCursor,
      resetCursor,
      setCursor,
      getResizeCursor,
    ]
  )

  /**
   * 選択ツールのマウスアップハンドラー
   */
  const handleSelectionMouseUp = useCallback(
    (originalEvent?: PointerEvent | MouseEvent): boolean => {
      if (currentTool !== "select") {
        // 掴んでいる間にツールが変わっても、動かした分はここで書く
        // （選択ツールの操作として始めたので、終わりもここが受ける）
        flushPendingMoves()
        return false
      }

      // リサイズ終了
      if (isResizing) {
        releasePointer(originalEvent)
        finishResize()
        setIsDraggingElement(false)
        resetCursor()
        return true
      }

      // 移動終了
      if (handleMovementEnd()) {
        releasePointer(originalEvent)
        resetCursor()
        return true
      }

      // 矩形選択終了
      if (completeRectangleSelection()) return true

      resetCursor()
      return false
    },
    [
      currentTool,
      isResizing,
      releasePointer,
      finishResize,
      handleMovementEnd,
      flushPendingMoves,
      completeRectangleSelection,
      resetCursor,
      setIsDraggingElement,
    ]
  )

  return {
    handleSelectionMouseDown,
    handleSelectionMouseMove,
    handleSelectionMouseUp,
    handleNewDrawingMouseDown,
    handleNewDrawingMouseMove,
    handleNewDrawingMouseUp,
  }
}
