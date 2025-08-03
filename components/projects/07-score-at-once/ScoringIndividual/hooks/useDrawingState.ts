import { DEFAULT_DRAWING_SETTINGS } from "@/components/projects/07-score-at-once/ScoringIndividual/constants/drawing-constants"
import type {
  DrawingActions,
  DrawingElement,
  DrawingState,
  DrawingTool,
  LineEditMode,
  LineStyle,
  RectangleEditMode,
  SelectionRectangle,
} from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import { useCallback, useState } from "react"

export function useDrawingState(): DrawingState & DrawingActions {
  // 基本的な描画設定
  const [currentTool, setCurrentTool] = useState<DrawingTool>("hand")
  const [strokeColor, setStrokeColor] = useState(
    DEFAULT_DRAWING_SETTINGS.strokeColor,
  )
  const [strokeWidth, setStrokeWidth] = useState(
    DEFAULT_DRAWING_SETTINGS.strokeWidth,
  )
  const [lineStyle, setLineStyle] = useState<LineStyle>(
    DEFAULT_DRAWING_SETTINGS.lineStyle,
  )
  const [fontSize, setFontSize] = useState(DEFAULT_DRAWING_SETTINGS.fontSize)

  // 描画要素とステート
  const [drawingElements, setDrawingElements] = useState<DrawingElement[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentDrawing, setCurrentDrawing] =
    useState<Partial<DrawingElement> | null>(null)

  // 選択とドラッグ（複数選択システム）
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([])
  const [isDraggingElement, setIsDraggingElement] = useState(false)
  const [dragElementOffset, setDragElementOffset] = useState({ x: 0, y: 0 })

  // 選択範囲ドラッグ
  const [isDrawingSelection, setIsDrawingSelection] = useState(false)
  const [selectionRectangle, setSelectionRectangle] =
    useState<SelectionRectangle | null>(null)

  // 編集モード
  const [lineEditMode, setLineEditMode] = useState<LineEditMode>(null)
  const [rectangleEditMode, setRectangleEditMode] =
    useState<RectangleEditMode>(null)

  // ハンドル編集
  const [isDraggingHandle, setIsDraggingHandle] = useState(false)
  const [currentHandle, setCurrentHandle] = useState<string | null>(null)

  // テキスト入力
  const [isCreatingTextBox, setIsCreatingTextBox] = useState(false)
  const [showTextInput, setShowTextInput] = useState(false)
  const [textInputPosition, setTextInputPosition] = useState({ x: 0, y: 0 })
  const [textInputValue, setTextInputValue] = useState("")

  // キーボード状態
  const [isShiftPressed, setIsShiftPressed] = useState(false)
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)

  // 描画要素操作
  const addDrawingElement = useCallback((element: DrawingElement) => {
    setDrawingElements((prev) => [...prev, element])
  }, [])

  const updateDrawingElement = useCallback(
    (id: string, updates: Partial<DrawingElement>) => {
      setDrawingElements((prev) =>
        prev.map((element) =>
          element.id === id ? { ...element, ...updates } : element,
        ),
      )
    },
    [],
  )

  const removeDrawingElement = useCallback((id: string) => {
    setDrawingElements((prev) => prev.filter((element) => element.id !== id))
    // 複数選択からも削除
    setSelectedElementIds((prev) =>
      prev.filter((elementId) => elementId !== id),
    )
  }, [])

  // 複数選択操作
  const addToSelection = useCallback((id: string) => {
    setSelectedElementIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const removeFromSelection = useCallback((id: string) => {
    setSelectedElementIds((prev) =>
      prev.filter((elementId) => elementId !== id),
    )
  }, [])

  const toggleSelection = useCallback((id: string) => {
    setSelectedElementIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((elementId) => elementId !== id)
      } else {
        return [...prev, id]
      }
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedElementIds([])
  }, [])

  // 重複判定：矩形と図形が重なっているかを判定する
  const isElementInRectangle = useCallback(
    (element: DrawingElement, rect: SelectionRectangle): boolean => {
      // 要素の境界ボックスを取得
      let elementLeft = element.x
      let elementTop = element.y
      let elementRight = element.x
      let elementBottom = element.y

      switch (element.type) {
        case "line":
          if (element.endX !== undefined && element.endY !== undefined) {
            elementLeft = Math.min(element.x, element.endX)
            elementTop = Math.min(element.y, element.endY)
            elementRight = Math.max(element.x, element.endX)
            elementBottom = Math.max(element.y, element.endY)
          }
          break
        case "rectangle":
          if (element.width !== undefined && element.height !== undefined) {
            elementRight = element.x + element.width
            elementBottom = element.y + element.height
          }
          break
        case "text":
          if (
            element.textBoxWidth !== undefined &&
            element.textBoxHeight !== undefined
          ) {
            elementRight = element.x + element.textBoxWidth
            elementBottom = element.y + element.textBoxHeight
          } else {
            // テキストの場合、小さな矩形として扱う
            elementRight = element.x + 0.05
            elementBottom = element.y + 0.03
          }
          break
      }

      // 選択範囲の境界ボックス
      const rectLeft = Math.min(rect.x, rect.x + rect.width)
      const rectTop = Math.min(rect.y, rect.y + rect.height)
      const rectRight = Math.max(rect.x, rect.x + rect.width)
      const rectBottom = Math.max(rect.y, rect.y + rect.height)

      // 重複判定（境界も含む）
      return !(
        elementRight < rectLeft ||
        elementLeft > rectRight ||
        elementBottom < rectTop ||
        elementTop > rectBottom
      )
    },
    [],
  )

  const selectElementsInRectangle = useCallback(
    (rect: SelectionRectangle) => {
      const elementsInRect = drawingElements
        .filter((element) => isElementInRectangle(element, rect))
        .map((element) => element.id)

      if (elementsInRect.length > 0) {
        setSelectedElementIds(elementsInRect)
      }
    },
    [drawingElements, isElementInRectangle],
  )

  const clearDrawing = useCallback(() => {
    setDrawingElements([])
    setSelectedElementIds([])
    setCurrentDrawing(null)
    setIsDrawing(false)
    setIsDrawingSelection(false)
    setSelectionRectangle(null)
  }, [])

  return {
    // State
    currentTool,
    strokeColor,
    strokeWidth,
    lineStyle,
    fontSize,
    drawingElements,
    isDrawing,
    currentDrawing,
    // 複数選択システム
    selectedElementIds,
    isDraggingElement,
    dragElementOffset,
    // 選択範囲ドラッグ
    isDrawingSelection,
    selectionRectangle,
    // その他
    lineEditMode,
    rectangleEditMode,
    isCreatingTextBox,
    showTextInput,
    textInputPosition,
    textInputValue,
    isShiftPressed,
    isCtrlPressed,
    isDraggingHandle,
    currentHandle,

    // Actions
    setCurrentTool,
    setStrokeColor: setStrokeColor as (color: string) => void,
    setStrokeWidth: setStrokeWidth as (width: number) => void,
    setLineStyle,
    setFontSize: setFontSize as (size: number) => void,
    setDrawingElements,
    addDrawingElement,
    updateDrawingElement,
    removeDrawingElement,
    // 複数選択システム
    setSelectedElementIds,
    addToSelection,
    removeFromSelection,
    toggleSelection,
    clearSelection,
    // 選択範囲
    setIsDrawingSelection,
    setSelectionRectangle,
    selectElementsInRectangle,
    clearDrawing,

    // Internal state updaters (for hooks that need direct access)
    setIsDrawing,
    setCurrentDrawing,
    setIsDraggingElement,
    setDragElementOffset,
    setLineEditMode,
    setRectangleEditMode,
    setIsCreatingTextBox,
    setShowTextInput,
    setTextInputPosition,
    setTextInputValue,
    setIsShiftPressed,
    setIsCtrlPressed,
    setIsDraggingHandle,
    setCurrentHandle,
  }
}
