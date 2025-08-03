import { useCursorUtils } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useCursorUtils"
import { useElementMovement } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useElementMovement"
import { useElementSelection } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useElementSelection"
import { useRectangleSelection } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useRectangleSelection"
import type {
  DrawingElement,
  SelectionRectangle,
} from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import { useCallback } from "react"

interface UseSelectionHandlersProps {
  currentTool: string
  drawingElements: DrawingElement[]
  selectedElementIds: string[]
  isDraggingElement: boolean
  isDrawingSelection: boolean
  selectionRectangle: SelectionRectangle | null
  isCtrlPressed: boolean
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
  getLineEditMode: (element: any, x: number, y: number) => any
  getRectangleEditMode: (element: any, x: number, y: number) => any
}

export function useSelectionHandlers(props: UseSelectionHandlersProps) {
  // Initialize cursor utilities
  const { setCursor, resetCursor } = useCursorUtils({
    canvasRef: props.canvasRef,
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
  })

  const { checkMovementStart, handleElementMovement, handleMovementEnd } =
    useElementMovement({
      currentTool: props.currentTool,
      drawingElements: props.drawingElements,
      selectedElementIds: props.selectedElementIds,
      isDraggingElement: props.isDraggingElement,
      lineEditMode: props.lineEditMode,
      dragElementOffset: props.dragElementOffset,
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

      console.log("🔽 handleSelectionMouseDown開始:", imageCoords)

      // Try element selection first
      const { elementSelected, clickedElement, clickedCoords } =
        handleElementSelection(imageCoords)

      console.log("🔄 handleElementSelection結果:", {
        elementSelected,
        clickedElement: clickedElement?.id,
        currentTool: props.currentTool,
        imageCoords,
        drawingElementsCount: props.drawingElements.length,
      })

      // If no element was selected, start rectangle selection
      if (!elementSelected) {
        console.log("📐 長方形選択を開始します - 要素選択に失敗")
        // 長方形選択開始時にクロスヘアカーソルを設定
        setCursor("crosshair")
        startRectangleSelection(imageCoords)
      } else {
        console.log("✅ 要素が選択されました - 即座に移動開始セットアップ")
        // 要素が選択された場合、即座に移動開始のセットアップを行う
        if (clickedElement && clickedCoords) {
          console.log("🚀 選択と同時に移動開始セットアップ:", {
            elementId: clickedElement.id,
            coords: clickedCoords,
            elementPos: { x: clickedElement.x, y: clickedElement.y },
          })

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
    [props, handleElementSelection, setCursor, startRectangleSelection],
  )

  // Check if mouse is over any element (for cursor styling)
  const checkElementHover = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (props.currentTool !== "select") return false

      // Check if any element is under the cursor
      for (let i = props.drawingElements.length - 1; i >= 0; i--) {
        const element = props.drawingElements[i]
        if (props.hitTestElement(element, imageCoords.x, imageCoords.y)) {
          return true
        }
      }
      return false
    },
    [props],
  )

  // Main mouse move handler
  const handleSelectionMouseMove = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (props.currentTool !== "select") {
        resetCursor()
        return false
      }

      // Update cursor based on current state
      if (props.isDrawingSelection) {
        // 長方形選択描画中はクロスヘアカーソル
        setCursor("crosshair")
      } else if (props.isDraggingElement) {
        // 要素ドラッグ中は移動カーソル
        setCursor("move")
      } else if (checkElementHover(imageCoords)) {
        // 要素の上にある場合は移動カーソル
        setCursor("move")
      } else {
        // それ以外は通常カーソル
        setCursor("normal")
      }

      // Handle element movement (only when already dragging)
      if (handleElementMovement(imageCoords)) return true

      // Handle rectangle selection update
      if (updateRectangleSelection(imageCoords)) return true

      return false
    },
    [
      props.currentTool,
      props.isDrawingSelection,
      props.isDraggingElement,
      setCursor,
      resetCursor,
      checkElementHover,
      handleElementMovement,
      updateRectangleSelection,
    ],
  )

  // Main mouse up handler
  const handleSelectionMouseUp = useCallback(() => {
    console.log("🔼 handleSelectionMouseUp開始:", {
      currentTool: props.currentTool,
      isDrawingSelection: props.isDrawingSelection,
    })

    if (props.currentTool !== "select") {
      console.log("❌ 選択ツールではない - mouseup処理をスキップ")
      return false
    }

    let handled = false

    // 長方形選択状態を事前に保存（completeRectangleSelectionがfalseに変更する前に）
    const wasDrawingSelection = props.isDrawingSelection

    // Handle movement end
    if (handleMovementEnd()) handled = true

    // Handle rectangle selection completion
    if (completeRectangleSelection()) handled = true

    // ドラッグ終了時はカーソルをリセット（成功・失敗に関係なく）
    if (wasDrawingSelection) {
      console.log("🖱️ ドラッグ終了 - カーソルリセット実行")
      resetCursor()
    } else {
      console.log("ℹ️ ドラッグしていなかった - カーソルリセットはスキップ")
    }

    console.log("🔼 handleSelectionMouseUp完了:", {
      handled,
      wasDrawingSelection,
    })
    return handled
  }, [
    props.currentTool,
    props.isDrawingSelection,
    handleMovementEnd,
    completeRectangleSelection,
    resetCursor,
  ])

  return {
    handleSelectionMouseDown,
    handleSelectionMouseMove,
    handleSelectionMouseUp,
  }
}
