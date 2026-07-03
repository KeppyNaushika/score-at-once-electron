/**
 * @fileoverview キャンバスインタラクションオーケストレーター
 * 選択・移動・リサイズ・新規描画を統合管理
 */
import { useCallback, useState } from "react"

import { useCursor } from "@/components/exams/07-score-at-once/ScoringIndividual/hooks/utils/useCursor"
import type {
  DrawingElement,
  LineStyle,
  SelectionRectangle,
} from "@/components/exams/07-score-at-once/ScoringIndividual/types/answerIndividualTypes"

import { useDrawingCreation } from "./useDrawingCreation"
import { useElementMovement } from "./useElementMovement"
import { type ResizeOriginalBounds, useElementResize } from "./useElementResize"
import { useElementSelection } from "./useElementSelection"
import { useRectangleSelection } from "./useRectangleSelection"

/** キャンバスインタラクションフックのプロパティ */
export interface UseCanvasInteractionProps {
  /** キャンバス参照 */
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** 現在のツール */
  currentTool: string
  /** 描画要素配列 */
  drawingElements: DrawingElement[]
  /** 選択中の要素ID配列 */
  selectedElementIds: string[]
  /** 要素ドラッグ中フラグ */
  isDraggingElement: boolean
  /** 描画中フラグ */
  isDrawing: boolean
  /** 現在描画中の要素 */
  currentDrawing: Partial<DrawingElement> | null
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
      | Partial<DrawingElement>
      | null
      | ((
          prev: Partial<DrawingElement> | null
        ) => Partial<DrawingElement> | null)
  ) => void
  setIsDraggingElement: (dragging: boolean) => void
  setDragElementOffset: (offset: { x: number; y: number }) => void
  setLineEditMode: (mode: "start" | "end" | "move" | null) => void
  setRectangleEditMode: (mode: "resize" | "move" | null) => void
  setDrawingElements: (
    elements: DrawingElement[] | ((prev: DrawingElement[]) => DrawingElement[])
  ) => void
  addDrawingElement: (element: DrawingElement) => void
  updateDrawingElement: (id: string, updates: Partial<DrawingElement>) => void
  removeDrawingElement: (id: string) => void

  // ユーティリティ
  hitTestElement: (element: DrawingElement, x: number, y: number) => boolean
  hitTestHandle: (
    element: DrawingElement,
    x: number,
    y: number
  ) => string | null
  getLineEditMode: (
    element: DrawingElement,
    x: number,
    y: number
  ) => "start" | "end" | "move" | null
  getRectangleEditMode: (
    element: DrawingElement,
    x: number,
    y: number
  ) => "resize" | "move" | null

  // コールバック
  onTextAnchorClick?: (position: { x: number; y: number }) => void
  onTextElementReClick?: (element: DrawingElement) => void
  setHoveredElementId?: (id: string | null) => void
}

/** キャンバスインタラクションフックの戻り値 */
export interface UseCanvasInteractionReturn {
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
  hitTestElement,
  hitTestHandle,
  getLineEditMode,
  getRectangleEditMode,
  onTextAnchorClick,
  onTextElementReClick,
  setHoveredElementId,
}: UseCanvasInteractionProps): UseCanvasInteractionReturn {
  // リサイズ状態
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [resizeElementId, setResizeElementId] = useState<string | null>(null)
  const [resizeOriginalBounds, setResizeOriginalBounds] =
    useState<ResizeOriginalBounds | null>(null)
  const [capturedPointerId, setCapturedPointerId] = useState<number | null>(
    null
  )

  // カーソル管理
  const { setCursor, resetCursor, getResizeCursor } = useCursor({
    canvasRef,
    hitTestHandle,
  })

  // 新規描画
  const {
    handleNewDrawingMouseDown,
    handleNewDrawingMouseMove,
    handleNewDrawingMouseUp,
  } = useDrawingCreation({
    currentTool,
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
  const { handleElementMovement, handleMovementEnd, initializeMoveStart } =
    useElementMovement({
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
      updateDrawingElement,
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

  /**
   * 2点間の距離を計算
   */
  const calcDistance = useCallback(
    (x1: number, y1: number, x2: number, y2: number) =>
      Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
    []
  )

  /**
   * 選択ツールのマウスダウンハンドラー
   */
  const handleSelectionMouseDown = useCallback(
    (
      imageCoords: { x: number; y: number },
      originalEvent?: PointerEvent | MouseEvent
    ): boolean => {
      if (currentTool !== "select") return false

      // ハンドルヒット情報を収集
      type HandleHit = {
        element: DrawingElement
        type: "line-endpoint" | "resize-handle" | "text-anchor"
        handleName: string
        distance: number
      }
      const handleHits: HandleHit[] = []

      for (const element of drawingElements) {
        if (element.type === "line") {
          const editMode = getLineEditMode(
            element,
            imageCoords.x,
            imageCoords.y
          )
          if (editMode === "start" || editMode === "end") {
            const handleX =
              editMode === "start" ? element.x : (element.endX ?? element.x)
            const handleY =
              editMode === "start" ? element.y : (element.endY ?? element.y)
            handleHits.push({
              element,
              type: "line-endpoint",
              handleName: editMode,
              distance: calcDistance(
                imageCoords.x,
                imageCoords.y,
                handleX,
                handleY
              ),
            })
          }
        } else if (element.type === "text") {
          const handleName = getResizeHandle(
            imageCoords.x,
            imageCoords.y,
            element
          )
          if (handleName === "anchor") {
            handleHits.push({
              element,
              type: "text-anchor",
              handleName: "anchor",
              distance: calcDistance(
                imageCoords.x,
                imageCoords.y,
                element.x,
                element.y
              ),
            })
          }
        } else {
          const handleName = getResizeHandle(
            imageCoords.x,
            imageCoords.y,
            element
          )
          if (handleName) {
            const width = element.width || 0
            const height = element.height || 0
            let handleX = element.x
            let handleY = element.y
            if (handleName.includes("right")) handleX += width
            if (handleName.includes("bottom")) handleY += height
            handleHits.push({
              element,
              type: "resize-handle",
              handleName,
              distance: calcDistance(
                imageCoords.x,
                imageCoords.y,
                handleX,
                handleY
              ),
            })
          }
        }
      }

      // 最も近いハンドルを選択
      if (handleHits.length > 0) {
        const closest = handleHits.reduce((handleHitA, handleHitB) =>
          handleHitA.distance < handleHitB.distance ? handleHitA : handleHitB
        )

        // ポインターキャプチャのヘルパー
        const capturePointer = () => {
          if (originalEvent && "pointerId" in originalEvent) {
            const canvas = canvasRef.current
            if (canvas) {
              try {
                canvas.setPointerCapture(originalEvent.pointerId)
                setCapturedPointerId(originalEvent.pointerId)
              } catch {
                // キャプチャ失敗は無視
              }
            }
          }
        }

        if (closest.type === "line-endpoint") {
          if (!selectedElementIds.includes(closest.element.id)) {
            setSelectedElementIds([closest.element.id])
          }
          setLineEditMode(closest.handleName as "start" | "end")
          setIsDraggingElement(true)
          setDragElementOffset({ x: 0, y: 0 })
          initializeMoveStart(imageCoords, [closest.element.id])
          capturePointer()

          const cursor = getResizeCursor(closest.element, closest.handleName)
          setCursor(cursor)
          return true
        } else if (closest.type === "text-anchor") {
          if (!selectedElementIds.includes(closest.element.id)) {
            setSelectedElementIds([closest.element.id])
          }
          setIsDraggingElement(true)
          setDragElementOffset({ x: 0, y: 0 })
          initializeMoveStart(imageCoords, [closest.element.id])
          capturePointer()
          setCursor("move")
          return true
        } else {
          // リサイズハンドル
          if (!selectedElementIds.includes(closest.element.id)) {
            setSelectedElementIds([closest.element.id])
          }
          setIsResizing(true)
          setIsDraggingElement(true)
          setResizeHandle(closest.handleName)
          setResizeElementId(closest.element.id)
          setResizeOriginalBounds({
            x: closest.element.x,
            y: closest.element.y,
            width: closest.element.width || 0,
            height: closest.element.height || 0,
          })
          capturePointer()

          const cursor = getResizeCursor(closest.element, closest.handleName)
          setCursor(cursor)
          return true
        }
      }

      // 要素選択を試みる
      const { elementSelected, clickedElement, clickedCoords } =
        handleElementSelection(imageCoords)

      if (!elementSelected) {
        setCursor("crosshair")
        startRectangleSelection(imageCoords)
      } else {
        if (clickedElement && clickedCoords) {
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

          if (originalEvent && "pointerId" in originalEvent) {
            const canvas = canvasRef.current
            if (canvas) {
              try {
                canvas.setPointerCapture(originalEvent.pointerId)
                setCapturedPointerId(originalEvent.pointerId)
              } catch {
                // キャプチャ失敗は無視
              }
            }
          }
        }
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
      setIsDraggingElement,
      setDragElementOffset,
      setLineEditMode,
      setSelectedElementIds,
      canvasRef,
      initializeMoveStart,
      onTextElementReClick,
      calcDistance,
    ]
  )

  /**
   * 要素ホバーをチェック
   */
  const checkElementHover = useCallback(
    (imageCoords: {
      x: number
      y: number
    }): {
      hasElement: boolean
      elementId: string | null
      elementType: string | null
    } => {
      if (currentTool !== "select")
        return { hasElement: false, elementId: null, elementType: null }

      for (let i = drawingElements.length - 1; i >= 0; i--) {
        const element = drawingElements[i]
        if (hitTestElement(element, imageCoords.x, imageCoords.y)) {
          return {
            hasElement: true,
            elementId: element.id,
            elementType: element.type,
          }
        }
      }
      return { hasElement: false, elementId: null, elementType: null }
    },
    [currentTool, drawingElements, hitTestElement]
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
      if (
        isResizing &&
        resizeHandle &&
        resizeElementId &&
        resizeOriginalBounds
      ) {
        const resizeElement = drawingElements.find(
          (element) => element.id === resizeElementId
        )
        if (resizeElement) {
          handleElementResize(
            imageCoords.x,
            imageCoords.y,
            resizeHandle,
            resizeElement,
            resizeOriginalBounds
          )
          return true
        }
      }

      // カーソル更新
      if (isResizing) {
        const cursor = getResizeCursor(null, resizeHandle || "")
        setCursor(cursor)
      } else if (isDrawingSelection) {
        setCursor("crosshair")
      } else if (isDraggingElement) {
        if (lineEditMode === "start" || lineEditMode === "end") {
          const selectedElement = drawingElements.find((element) =>
            selectedElementIds.includes(element.id)
          )
          if (selectedElement) {
            const cursor = getResizeCursor(selectedElement, lineEditMode)
            setCursor(cursor)
          }
        } else {
          setCursor("move")
        }
      } else {
        // アイドル状態でのカーソル判定
        let cursorSet = false
        let hoveredId: string | null = null

        for (let i = drawingElements.length - 1; i >= 0 && !cursorSet; i--) {
          const element = drawingElements[i]

          if (element.type === "line") {
            const editMode = getLineEditMode(
              element,
              imageCoords.x,
              imageCoords.y
            )
            if (editMode === "start" || editMode === "end") {
              const cursor = getResizeCursor(element, editMode)
              setCursor(cursor)
              hoveredId = element.id
              cursorSet = true
            }
          } else if (element.type === "text") {
            const handleName = getResizeHandle(
              imageCoords.x,
              imageCoords.y,
              element
            )
            if (handleName === "anchor") {
              setCursor("move")
              hoveredId = element.id
              cursorSet = true
            }
          } else {
            const handleName = getResizeHandle(
              imageCoords.x,
              imageCoords.y,
              element
            )
            if (handleName) {
              const cursor = getResizeCursor(element, handleName)
              setCursor(cursor)
              hoveredId = element.id
              cursorSet = true
            }
          }
        }

        if (!cursorSet) {
          const hoverResult = checkElementHover(imageCoords)
          if (hoverResult.hasElement) {
            if (hoverResult.elementType === "text") {
              setCursor("text")
            } else {
              setCursor("move")
            }
            hoveredId = hoverResult.elementId
            cursorSet = true
          }
        }

        if (!cursorSet) {
          setCursor("crosshair")
        }

        if (setHoveredElementId) {
          setHoveredElementId(hoveredId)
        }
      }

      // 要素移動
      if (handleElementMovement(imageCoords)) return true

      // 矩形選択更新
      if (updateRectangleSelection(imageCoords)) return true

      return false
    },
    [
      currentTool,
      isResizing,
      resizeHandle,
      resizeElementId,
      resizeOriginalBounds,
      drawingElements,
      handleElementResize,
      selectedElementIds,
      getResizeHandle,
      isDrawingSelection,
      isDraggingElement,
      lineEditMode,
      getLineEditMode,
      handleElementMovement,
      updateRectangleSelection,
      resetCursor,
      setCursor,
      getResizeCursor,
      checkElementHover,
      setHoveredElementId,
    ]
  )

  /**
   * 選択ツールのマウスアップハンドラー
   */
  const handleSelectionMouseUp = useCallback(
    (originalEvent?: PointerEvent | MouseEvent): boolean => {
      if (currentTool !== "select") return false

      // ポインターリリースヘルパー
      const releasePointer = () => {
        if (
          capturedPointerId !== null &&
          originalEvent &&
          "pointerId" in originalEvent
        ) {
          const canvas = canvasRef.current
          if (canvas) {
            try {
              canvas.releasePointerCapture(originalEvent.pointerId)
            } catch {
              // リリース失敗は無視
            }
          }
        }
      }

      // リサイズ終了
      if (isResizing) {
        releasePointer()

        if (resizeElementId) {
          const resizedElement = drawingElements.find(
            (element) => element.id === resizeElementId
          )
          if (resizedElement) {
            const updates: Partial<DrawingElement> = {
              x: resizedElement.x,
              y: resizedElement.y,
            }
            if (resizedElement.type === "text") {
              updates.textBoxWidth = resizedElement.textBoxWidth
              updates.textBoxHeight = resizedElement.textBoxHeight
            } else {
              updates.width = resizedElement.width
              updates.height = resizedElement.height
            }
            updateDrawingElement(resizedElement.id, updates)
          }
        }

        setIsResizing(false)
        setIsDraggingElement(false)
        setResizeHandle(null)
        setResizeElementId(null)
        setResizeOriginalBounds(null)
        setCapturedPointerId(null)
        resetCursor()
        return true
      }

      // 移動終了
      if (handleMovementEnd()) {
        releasePointer()
        setCapturedPointerId(null)
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
      capturedPointerId,
      canvasRef,
      resizeElementId,
      drawingElements,
      updateDrawingElement,
      handleMovementEnd,
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
