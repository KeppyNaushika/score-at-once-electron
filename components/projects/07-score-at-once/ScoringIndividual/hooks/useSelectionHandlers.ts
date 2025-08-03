import { useCursorUtils } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useCursorUtils"
import { useElementMovement } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useElementMovement"
import { useElementSelection } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useElementSelection"
import { useRectangleSelection } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useRectangleSelection"
import { useResizeCursorUtils } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useResizeCursorUtils"
import type {
  DrawingElement,
  SelectionRectangle,
} from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import { useCallback, useState } from "react"

interface UseSelectionHandlersProps {
  currentTool: string
  drawingElements: DrawingElement[]
  selectedElementIds: string[]
  isDraggingElement: boolean
  isDrawingSelection: boolean
  selectionRectangle: SelectionRectangle | null
  isCtrlPressed: boolean
  isShiftPressed: boolean
  lineEditMode: any
  dragElementOffset: { x: number; y: number }

  // Canvas ref for cursor management
  canvasRef: React.RefObject<HTMLCanvasElement | null>

  // Actions
  toggleSelection: (id: string) => void
  setSelectedElementIds: (ids: string[]) => void
  clearSelection: () => void
  setIsDrawingSelection: (drawing: boolean) => void
  setSelectionRectangle: (rect: SelectionRectangle | null) => void
  selectElementsInRectangle: (rect: SelectionRectangle) => void
  setIsDraggingElement: (dragging: boolean) => void
  setDragElementOffset: (offset: { x: number; y: number }) => void
  setLineEditMode: (mode: any) => void
  setRectangleEditMode: (mode: any) => void
  updateDrawingElement: (id: string, updates: any) => void

  // Utils
  hitTestElement: (element: any, x: number, y: number) => boolean
  hitTestHandle: (element: any, x: number, y: number) => string | null
  getLineEditMode: (element: any, x: number, y: number) => any
  getRectangleEditMode: (element: any, x: number, y: number) => any

  // テキスト再編集
  onTextElementReClick?: (element: any) => void
}

export function useSelectionHandlers(props: UseSelectionHandlersProps) {
  // リサイズ状態管理
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<string | null>(null)
  const [resizeElementId, setResizeElementId] = useState<string | null>(null)
  const [resizeStartCoords, setResizeStartCoords] = useState<{
    x: number
    y: number
  } | null>(null)
  const [resizeOriginalBounds, setResizeOriginalBounds] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  // Initialize cursor utilities
  const { setCursor, resetCursor } = useCursorUtils({
    canvasRef: props.canvasRef,
  })

  // Initialize resize cursor utilities
  const { checkResizeHandle } = useResizeCursorUtils({
    hitTestHandle: props.hitTestHandle,
  })

  // Initialize specialized handlers
  const { handleElementSelection } = useElementSelection({
    currentTool: props.currentTool,
    drawingElements: props.drawingElements,
    selectedElementIds: props.selectedElementIds,
    isCtrlPressed: props.isCtrlPressed,
    toggleSelection: props.toggleSelection,
    setSelectedElementIds: props.setSelectedElementIds,
    clearSelection: props.clearSelection,
    setLineEditMode: props.setLineEditMode,
    setRectangleEditMode: props.setRectangleEditMode,
    hitTestElement: props.hitTestElement,
    getLineEditMode: props.getLineEditMode,
    getRectangleEditMode: props.getRectangleEditMode,
    onTextElementReClick: props.onTextElementReClick,
  })

  const { checkMovementStart, handleElementMovement, handleMovementEnd } =
    useElementMovement({
      currentTool: props.currentTool,
      drawingElements: props.drawingElements,
      selectedElementIds: props.selectedElementIds,
      isDraggingElement: props.isDraggingElement,
      lineEditMode: props.lineEditMode,
      dragElementOffset: props.dragElementOffset,
      isShiftPressed: props.isShiftPressed,
      setIsDraggingElement: props.setIsDraggingElement,
      setDragElementOffset: props.setDragElementOffset,
      setLineEditMode: props.setLineEditMode,
      setRectangleEditMode: props.setRectangleEditMode,
      updateDrawingElement: props.updateDrawingElement,
      hitTestElement: props.hitTestElement,
    })

  const {
    startRectangleSelection,
    updateRectangleSelection,
    completeRectangleSelection,
  } = useRectangleSelection({
    currentTool: props.currentTool,
    drawingElements: props.drawingElements,
    selectedElementIds: props.selectedElementIds,
    isDrawingSelection: props.isDrawingSelection,
    selectionRectangle: props.selectionRectangle,
    isCtrlPressed: props.isCtrlPressed,
    clearSelection: props.clearSelection,
    setIsDrawingSelection: props.setIsDrawingSelection,
    setSelectionRectangle: props.setSelectionRectangle,
    selectElementsInRectangle: props.selectElementsInRectangle,
    setSelectedElementIds: props.setSelectedElementIds,
    setLineEditMode: props.setLineEditMode,
    setRectangleEditMode: props.setRectangleEditMode,
  })

  // Main mouse down handler
  const handleSelectionMouseDown = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (props.currentTool !== "select") return false

      // 選択された要素がある場合、まずリサイズハンドルをチェック
      if (props.selectedElementIds.length > 0) {
        const selectedElement = props.drawingElements.find((el) =>
          props.selectedElementIds.includes(el.id),
        )

        if (selectedElement) {
          const resizeCursor = checkResizeHandle(
            selectedElement,
            imageCoords.x,
            imageCoords.y,
          )

          if (resizeCursor) {
            // リサイズモード開始
            setIsResizing(true)
            setResizeDirection(resizeCursor)
            setResizeElementId(selectedElement.id)
            setResizeStartCoords(imageCoords)

            // 元のサイズと位置を保存
            const bounds = {
              x: selectedElement.x,
              y: selectedElement.y,
              width: selectedElement.textBoxWidth || selectedElement.width || 0,
              height:
                selectedElement.textBoxHeight || selectedElement.height || 0,
            }
            setResizeOriginalBounds(bounds)

            setCursor(resizeCursor as any)
            return true
          }
        }
      }

      // Try element selection first
      const { elementSelected, clickedElement, clickedCoords } =
        handleElementSelection(imageCoords)

      // If no element was selected, start rectangle selection
      if (!elementSelected) {
        // 長方形選択開始時にクロスヘアカーソルを設定
        setCursor("crosshair")
        startRectangleSelection(imageCoords)
      } else {
        // 要素が選択された場合、即座に移動開始のセットアップを行う
        if (clickedElement && clickedCoords) {
          // 移動開始状態をセット
          props.setIsDraggingElement(true)
          const dragOffsetX = clickedCoords.x - clickedElement.x
          const dragOffsetY = clickedCoords.y - clickedElement.y
          props.setDragElementOffset({
            x: dragOffsetX,
            y: dragOffsetY,
          })
        }
      }

      return true
    },
    [
      props,
      handleElementSelection,
      setCursor,
      startRectangleSelection,
      checkResizeHandle,
    ],
  )

  // Check if mouse is over any element (for cursor styling)
  const checkElementHover = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (props.currentTool !== "select")
        return { hasElement: false, resizeCursor: null }

      // Check if any element is under the cursor
      for (let i = props.drawingElements.length - 1; i >= 0; i--) {
        const element = props.drawingElements[i]

        // まずリサイズハンドルをチェック（優先度高）
        const resizeCursor = checkResizeHandle(
          element,
          imageCoords.x,
          imageCoords.y,
        )
        if (resizeCursor) {
          return { hasElement: true, resizeCursor: resizeCursor }
        }

        // 次に要素本体をチェック
        if (props.hitTestElement(element, imageCoords.x, imageCoords.y)) {
          return { hasElement: true, resizeCursor: null }
        }
      }
      return { hasElement: false, resizeCursor: null }
    },
    [props, checkResizeHandle],
  )

  // Main mouse move handler
  const handleSelectionMouseMove = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (props.currentTool !== "select") {
        resetCursor()
        return false
      }

      // リサイズ中の処理
      if (
        isResizing &&
        resizeElementId &&
        resizeStartCoords &&
        resizeOriginalBounds &&
        resizeDirection
      ) {
        const deltaX = imageCoords.x - resizeStartCoords.x
        const deltaY = imageCoords.y - resizeStartCoords.y

        let newX = resizeOriginalBounds.x
        let newY = resizeOriginalBounds.y
        let newWidth = resizeOriginalBounds.width
        let newHeight = resizeOriginalBounds.height

        // リサイズ方向に応じて座標とサイズを更新
        switch (resizeDirection) {
          case "nw-resize": // 左上
            newX = resizeOriginalBounds.x + deltaX
            newY = resizeOriginalBounds.y + deltaY
            newWidth = resizeOriginalBounds.width - deltaX
            newHeight = resizeOriginalBounds.height - deltaY
            break
          case "ne-resize": // 右上
            newY = resizeOriginalBounds.y + deltaY
            newWidth = resizeOriginalBounds.width + deltaX
            newHeight = resizeOriginalBounds.height - deltaY
            break
          case "sw-resize": // 左下
            newX = resizeOriginalBounds.x + deltaX
            newWidth = resizeOriginalBounds.width - deltaX
            newHeight = resizeOriginalBounds.height + deltaY
            break
          case "se-resize": // 右下
            newWidth = resizeOriginalBounds.width + deltaX
            newHeight = resizeOriginalBounds.height + deltaY
            break
          case "nwse-resize": // 左上右下 (fallback)
            newWidth = resizeOriginalBounds.width + deltaX
            newHeight = resizeOriginalBounds.height + deltaY
            break
          case "nesw-resize": // 右上左下 (fallback)
            newX = resizeOriginalBounds.x + deltaX
            newY = resizeOriginalBounds.y + deltaY
            newWidth = resizeOriginalBounds.width - deltaX
            newHeight = resizeOriginalBounds.height - deltaY
            break
        }

        // 最小サイズ制限
        const minSize = 20
        if (newWidth < minSize) {
          newWidth = minSize
          if (resizeDirection.includes("w")) {
            newX = resizeOriginalBounds.x + resizeOriginalBounds.width - minSize
          }
        }
        if (newHeight < minSize) {
          newHeight = minSize
          if (resizeDirection.includes("n")) {
            newY =
              resizeOriginalBounds.y + resizeOriginalBounds.height - minSize
          }
        }

        // 要素を更新
        const updates: any = {
          x: newX,
          y: newY,
        }

        const element = props.drawingElements.find(
          (el) => el.id === resizeElementId,
        )
        if (element?.type === "text") {
          updates.textBoxWidth = newWidth
          updates.textBoxHeight = newHeight
        } else {
          updates.width = newWidth
          updates.height = newHeight
        }

        props.updateDrawingElement(resizeElementId, updates)
        return true
      }

      // Update cursor based on current state
      if (props.isDrawingSelection) {
        // 長方形選択描画中はクロスヘアカーソル
        setCursor("crosshair")
      } else if (props.isDraggingElement) {
        // 要素ドラッグ中は移動カーソル
        setCursor("move")
      } else {
        // 要素ホバー判定
        const hoverResult = checkElementHover(imageCoords)

        if (hoverResult.hasElement) {
          if (hoverResult.resizeCursor) {
            // リサイズハンドルの上にある場合はリサイズカーソル
            setCursor(hoverResult.resizeCursor as any)
          } else {
            // 要素の上にある場合は移動カーソル（選択可能）
            setCursor("move")
          }
        } else {
          // 要素がない場所はクロスヘアカーソル（長方形選択可能）
          setCursor("crosshair")
        }
      }

      // Handle element movement (only when already dragging)
      if (handleElementMovement(imageCoords)) return true

      // Handle rectangle selection update
      if (updateRectangleSelection(imageCoords)) return true

      return false
    },
    [
      props,
      isResizing,
      resizeElementId,
      resizeStartCoords,
      resizeOriginalBounds,
      resizeDirection,
      handleElementMovement,
      updateRectangleSelection,
      resetCursor,
      setCursor,
      checkElementHover,
    ],
  )

  // Main mouse up handler
  const handleSelectionMouseUp = useCallback(() => {
    if (props.currentTool !== "select") return false

    let handled = false

    // リサイズ終了処理
    if (isResizing) {
      setIsResizing(false)
      setResizeDirection(null)
      setResizeElementId(null)
      setResizeStartCoords(null)
      setResizeOriginalBounds(null)
      resetCursor()
      return true
    }

    // 長方形選択状態を事前に保存（completeRectangleSelectionがfalseに変更する前に）
    const wasDrawingSelection = props.isDrawingSelection

    // Handle movement end
    if (handleMovementEnd()) handled = true

    // Handle rectangle selection completion
    if (completeRectangleSelection()) handled = true

    // ドラッグ終了時はカーソルをリセット（成功・失敗に関係なく）
    if (wasDrawingSelection) {
      resetCursor()
    }

    return handled
  }, [
    props.currentTool,
    props.isDrawingSelection,
    handleMovementEnd,
    completeRectangleSelection,
    resetCursor,
    isResizing,
  ])

  return {
    handleSelectionMouseDown,
    handleSelectionMouseMove,
    handleSelectionMouseUp,
  }
}
