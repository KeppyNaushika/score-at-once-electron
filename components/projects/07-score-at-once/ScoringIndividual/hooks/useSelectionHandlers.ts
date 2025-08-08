import { useCursorUtils } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useCursorUtils"
import { useElementMovement } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useElementMovement"
import { useElementSelection } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useElementSelection"
import { useRectangleSelection } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useRectangleSelection"
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

export function useSelectionHandlers({
  currentTool,
  drawingElements,
  selectedElementIds,
  isDraggingElement,
  isDrawingSelection,
  selectionRectangle,
  isCtrlPressed,
  isShiftPressed,
  lineEditMode,
  dragElementOffset,
  canvasRef,
  toggleSelection,
  setSelectedElementIds,
  clearSelection,
  setIsDrawingSelection,
  setSelectionRectangle,
  selectElementsInRectangle,
  setIsDraggingElement,
  setDragElementOffset,
  setLineEditMode,
  setRectangleEditMode,
  updateDrawingElement,
  hitTestElement,
  hitTestHandle,
  getLineEditMode,
  getRectangleEditMode,
  onTextElementReClick,
}: UseSelectionHandlersProps) {
  
  // リサイズ状態管理
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [resizeElementId, setResizeElementId] = useState<string | null>(null)
  const [resizeOriginalBounds, setResizeOriginalBounds] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  
  // ポインターキャプチャ管理
  const [capturedPointerId, setCapturedPointerId] = useState<number | null>(null)
  // Initialize cursor utilities
  const { setCursor, resetCursor } = useCursorUtils({
    canvasRef,
  })
  
  // 負値の幅・高さを正規化（座標入れ替え）
  const normalizeNegativeDimensions = useCallback((x: number, y: number, width: number, height: number) => {
    let normalizedX = x
    let normalizedY = y
    let normalizedWidth = width
    let normalizedHeight = height
    
    // 負の幅の場合：左右を入れ替え
    if (width < 0) {
      normalizedX = x + width  // 左端を右端に移動
      normalizedWidth = Math.abs(width)  // 絶対値に
    }
    
    // 負の高さの場合：上下を入れ替え
    if (height < 0) {
      normalizedY = y + height  // 上端を下端に移動
      normalizedHeight = Math.abs(height)  // 絶対値に
    }
    
    return {
      x: normalizedX,
      y: normalizedY,
      width: normalizedWidth,
      height: normalizedHeight
    }
  }, [])

  // 正規化座標での境界制限
  const clampNormalized = useCallback((x: number, y: number, width: number, height: number) => {
    // まず負値を正規化（座標入れ替え）
    const normalized = normalizeNegativeDimensions(x, y, width, height)
    
    // 座標を0-1範囲にクランプ
    const clampedX = Math.max(0, Math.min(1, normalized.x))
    const clampedY = Math.max(0, Math.min(1, normalized.y))
    
    // サイズを制限（座標+サイズが1を超えないように）
    const maxWidth = 1 - clampedX
    const maxHeight = 1 - clampedY
    const clampedWidth = Math.max(0.01, Math.min(maxWidth, normalized.width))  // 最小1%
    const clampedHeight = Math.max(0.01, Math.min(maxHeight, normalized.height)) // 最小1%
    
    return {
      x: clampedX,
      y: clampedY,
      width: clampedWidth,
      height: clampedHeight
    }
  }, [normalizeNegativeDimensions])
  
  // リサイズハンドルの判定（正規化座標）
  const getResizeHandle = useCallback((normalizedX: number, normalizedY: number, element: any): string | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    
    const handleSizeNormalized = 8 / canvas.width  // ハンドルサイズを正規化
    const tolerance = handleSizeNormalized / 2
    
    // 要素の境界を取得
    const elementX = element.x
    const elementY = element.y
    const elementWidth = element.textBoxWidth || element.width || 0
    const elementHeight = element.textBoxHeight || element.height || 0
    
    const handles = [
      { x: elementX, y: elementY, name: 'top-left' },
      { x: elementX + elementWidth, y: elementY, name: 'top-right' },
      { x: elementX, y: elementY + elementHeight, name: 'bottom-left' },
      { x: elementX + elementWidth, y: elementY + elementHeight, name: 'bottom-right' }
    ]
    
    for (const handle of handles) {
      if (Math.abs(normalizedX - handle.x) <= tolerance && Math.abs(normalizedY - handle.y) <= tolerance) {
        return handle.name
      }
    }
    
    return null
  }, [canvasRef])
  
  // リサイズ処理（正規化座標）
  const handleElementResize = useCallback((
    normalizedX: number, 
    normalizedY: number, 
    handle: string, 
    element: any,
    originalBounds: { x: number; y: number; width: number; height: number }
  ) => {
    // マウス座標を0-1にクランプしてからwidth/height計算
    const clampedMouseX = Math.max(0, Math.min(1, normalizedX))
    const clampedMouseY = Math.max(0, Math.min(1, normalizedY))
    
    let newX = originalBounds.x
    let newY = originalBounds.y
    let newWidth = originalBounds.width
    let newHeight = originalBounds.height
    
    switch (handle) {
      case 'top-left':
        newWidth = originalBounds.x + originalBounds.width - clampedMouseX
        newHeight = originalBounds.y + originalBounds.height - clampedMouseY
        newX = clampedMouseX
        newY = clampedMouseY
        break
      case 'top-right':
        newWidth = clampedMouseX - originalBounds.x
        newHeight = originalBounds.y + originalBounds.height - clampedMouseY
        newY = clampedMouseY
        break
      case 'bottom-left':
        newWidth = originalBounds.x + originalBounds.width - clampedMouseX
        newHeight = clampedMouseY - originalBounds.y
        newX = clampedMouseX
        break
      case 'bottom-right':
        newWidth = clampedMouseX - originalBounds.x
        newHeight = clampedMouseY - originalBounds.y
        break
    }
    
    // 最終的な境界制限を適用
    const clamped = clampNormalized(newX, newY, newWidth, newHeight)
    
    // 要素を更新
    const updates: any = {
      x: clamped.x,
      y: clamped.y,
    }

    if (element.type === "text") {
      updates.textBoxWidth = clamped.width
      updates.textBoxHeight = clamped.height
    } else {
      updates.width = clamped.width
      updates.height = clamped.height
    }
    
    updateDrawingElement(element.id, updates)
  }, [clampNormalized, updateDrawingElement])

  // Initialize specialized handlers
  const { handleElementSelection } = useElementSelection({
    currentTool,
    drawingElements,
    selectedElementIds,
    isCtrlPressed,
    toggleSelection,
    setSelectedElementIds,
    clearSelection,
    setLineEditMode,
    setRectangleEditMode,
    hitTestElement,
    getLineEditMode,
    getRectangleEditMode,
    onTextElementReClick,
  })

  const { checkMovementStart, handleElementMovement, handleMovementEnd } =
    useElementMovement({
      currentTool,
      drawingElements,
      selectedElementIds,
      isDraggingElement,
      lineEditMode,
      dragElementOffset,
      isShiftPressed,
      setIsDraggingElement,
      setDragElementOffset,
      setLineEditMode,
      setRectangleEditMode,
      updateDrawingElement,
      hitTestElement,
    })

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

  // Main mouse down handler
  const handleSelectionMouseDown = useCallback(
    (
      imageCoords: { x: number; y: number },
      originalEvent?: PointerEvent | MouseEvent,
    ) => {
      if (currentTool !== "select") return false

      // 選択された要素がある場合、まずリサイズハンドルをチェック
      if (selectedElementIds.length > 0) {
        const selectedElement = drawingElements.find((el) =>
          selectedElementIds.includes(el.id),
        )

        if (selectedElement) {
          // リサイズハンドルをチェック
          const handleName = getResizeHandle(
            imageCoords.x,
            imageCoords.y,
            selectedElement
          )

          if (handleName) {
            // リサイズ開始
            setIsResizing(true)
            setResizeHandle(handleName)
            setResizeElementId(selectedElement.id)

            // 元のサイズと位置を保存
            const bounds = {
              x: selectedElement.x,
              y: selectedElement.y,
              width: selectedElement.textBoxWidth || selectedElement.width || 0,
              height: selectedElement.textBoxHeight || selectedElement.height || 0,
            }
            setResizeOriginalBounds(bounds)

            // ポインターキャプチャを開始
            if (originalEvent && "pointerId" in originalEvent) {
              const canvas = canvasRef.current
              if (canvas) {
                try {
                  canvas.setPointerCapture(originalEvent.pointerId)
                  setCapturedPointerId(originalEvent.pointerId)
                } catch (error) {
                  console.log("⚠️ setPointerCapture failed:", error)
                }
              }
            }

            // リサイズカーソルを設定
            const cursorMap: { [key: string]: any } = {
              'top-left': 'nwse-resize',
              'top-right': 'nesw-resize',
              'bottom-left': 'nesw-resize',
              'bottom-right': 'nwse-resize'
            }
            setCursor(cursorMap[handleName] || 'nwse-resize')
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
          setIsDraggingElement(true)
          const dragOffsetX = clickedCoords.x - clickedElement.x
          const dragOffsetY = clickedCoords.y - clickedElement.y
          setDragElementOffset({
            x: dragOffsetX,
            y: dragOffsetY,
          })
        }
      }

      return true
    },
    [
      currentTool,
      selectedElementIds,
      drawingElements,
      getResizeHandle,
      handleElementSelection,
      setCursor,
      startRectangleSelection,
      setIsDraggingElement,
      setDragElementOffset,
      canvasRef,
    ],
  )

  // Check if mouse is over any element (for cursor styling)
  const checkElementHover = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (currentTool !== "select") return { hasElement: false }

      // Check if any element is under the cursor
      for (let i = drawingElements.length - 1; i >= 0; i--) {
        const element = drawingElements[i]

        if (hitTestElement(element, imageCoords.x, imageCoords.y)) {
          return { hasElement: true }
        }
      }
      return { hasElement: false }
    },
    [currentTool, drawingElements, hitTestElement],
  )

  // Main mouse move handler
  const handleSelectionMouseMove = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (currentTool !== "select") {
        resetCursor()
        return false
      }

      // Handle resize operations first (highest priority)
      if (isResizing && resizeHandle && resizeElementId && resizeOriginalBounds) {
        const resizeElement = drawingElements.find(el => el.id === resizeElementId)
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

      // Update cursor based on current state
      if (isResizing) {
        // リサイズ中は専用カーソル
        const cursorMap: { [key: string]: any } = {
          'top-left': 'nwse-resize',
          'top-right': 'nesw-resize',
          'bottom-left': 'nesw-resize',
          'bottom-right': 'nwse-resize'
        }
        setCursor(cursorMap[resizeHandle || ''] || 'nwse-resize')
      } else if (isDrawingSelection) {
        // 長方形選択描画中はクロスヘアカーソル
        setCursor("crosshair")
      } else if (isDraggingElement) {
        // 要素ドラッグ中は移動カーソル
        setCursor("move")
      } else {
        // リサイズハンドルのホバー判定を最初にチェック
        if (selectedElementIds.length > 0) {
          const selectedElement = drawingElements.find((el) =>
            selectedElementIds.includes(el.id),
          )
          if (selectedElement) {
            const handleName = getResizeHandle(
              imageCoords.x,
              imageCoords.y,
              selectedElement
            )
            if (handleName) {
              // リサイズハンドル上ではリサイズカーソル
              const cursorMap: { [key: string]: any } = {
                'top-left': 'nwse-resize',
                'top-right': 'nesw-resize',
                'bottom-left': 'nesw-resize',
                'bottom-right': 'nwse-resize'
              }
              setCursor(cursorMap[handleName] || 'nwse-resize')
            } else {
              // 要素ホバー判定
              const hoverResult = checkElementHover(imageCoords)
              if (hoverResult.hasElement) {
                setCursor("move")
              } else {
                setCursor("crosshair")
              }
            }
          } else {
            // 要素ホバー判定
            const hoverResult = checkElementHover(imageCoords)
            if (hoverResult.hasElement) {
              setCursor("move")
            } else {
              setCursor("crosshair")
            }
          }
        } else {
          // 要素ホバー判定
          const hoverResult = checkElementHover(imageCoords)
          if (hoverResult.hasElement) {
            setCursor("move")
          } else {
            setCursor("crosshair")
          }
        }
      }

      // Handle element movement (only when already dragging)
      if (handleElementMovement(imageCoords)) return true

      // Handle rectangle selection update
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
      handleElementMovement,
      updateRectangleSelection,
      resetCursor,
      setCursor,
      checkElementHover,
    ],
  )

  // Main mouse up handler
  const handleSelectionMouseUp = useCallback((
    originalEvent?: PointerEvent | MouseEvent,
  ) => {
    if (currentTool !== "select") return false

    // Handle resize termination first (highest priority)
    if (isResizing && capturedPointerId !== null) {
      const canvas = canvasRef.current
      if (canvas && originalEvent && "pointerId" in originalEvent) {
        try {
          canvas.releasePointerCapture(originalEvent.pointerId)
        } catch (error) {
          console.log("⚠️ releasePointerCapture warning:", error)
        }
      }
      
      // リサイズ状態をクリア
      setIsResizing(false)
      setResizeHandle(null)
      setResizeElementId(null)
      setResizeOriginalBounds(null)
      setCapturedPointerId(null)
      
      resetCursor()
      return true
    }

    // Element movement終了
    if (handleMovementEnd()) return true

    // Rectangle selection終了
    if (completeRectangleSelection()) return true

    resetCursor()
    return false
  }, [
    currentTool, 
    isResizing, 
    capturedPointerId, 
    canvasRef,
    handleMovementEnd, 
    completeRectangleSelection, 
    resetCursor
  ])

  return {
    handleSelectionMouseDown,
    handleSelectionMouseMove,
    handleSelectionMouseUp,
  }
}
