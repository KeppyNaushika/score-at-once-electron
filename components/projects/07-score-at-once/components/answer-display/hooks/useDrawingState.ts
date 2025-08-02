import { useState, useCallback } from "react"
import type { 
  DrawingState, 
  DrawingActions, 
  DrawingElement, 
  DrawingTool, 
  LineStyle,
  LineEditMode,
  RectangleEditMode
} from "../types/answer-display-types"
import { DEFAULT_DRAWING_SETTINGS } from "../constants/drawing-constants"

export function useDrawingState(): DrawingState & DrawingActions {
  // 基本的な描画設定
  const [currentTool, setCurrentTool] = useState<DrawingTool>("hand")
  const [strokeColor, setStrokeColor] = useState(DEFAULT_DRAWING_SETTINGS.strokeColor)
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_DRAWING_SETTINGS.strokeWidth)
  const [lineStyle, setLineStyle] = useState<LineStyle>(DEFAULT_DRAWING_SETTINGS.lineStyle)
  const [fontSize, setFontSize] = useState(DEFAULT_DRAWING_SETTINGS.fontSize)

  // 描画要素とステート
  const [drawingElements, setDrawingElements] = useState<DrawingElement[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentDrawing, setCurrentDrawing] = useState<Partial<DrawingElement> | null>(null)
  
  // 選択とドラッグ
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [isDraggingElement, setIsDraggingElement] = useState(false)
  const [dragElementOffset, setDragElementOffset] = useState({ x: 0, y: 0 })
  
  // 編集モード
  const [lineEditMode, setLineEditMode] = useState<LineEditMode>(null)
  const [rectangleEditMode, setRectangleEditMode] = useState<RectangleEditMode>(null)
  
  // テキスト入力
  const [isCreatingTextBox, setIsCreatingTextBox] = useState(false)
  const [showTextInput, setShowTextInput] = useState(false)
  const [textInputPosition, setTextInputPosition] = useState({ x: 0, y: 0 })
  const [textInputValue, setTextInputValue] = useState("")
  
  // キーボード状態
  const [isShiftPressed, setIsShiftPressed] = useState(false)

  // 描画要素操作
  const addDrawingElement = useCallback((element: DrawingElement) => {
    setDrawingElements(prev => [...prev, element])
  }, [])

  const updateDrawingElement = useCallback((id: string, updates: Partial<DrawingElement>) => {
    setDrawingElements(prev => 
      prev.map(element => 
        element.id === id ? { ...element, ...updates } : element
      )
    )
  }, [])

  const removeDrawingElement = useCallback((id: string) => {
    setDrawingElements(prev => prev.filter(element => element.id !== id))
    if (selectedElementId === id) {
      setSelectedElementId(null)
    }
  }, [selectedElementId])

  const clearDrawing = useCallback(() => {
    setDrawingElements([])
    setSelectedElementId(null)
    setCurrentDrawing(null)
    setIsDrawing(false)
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
    selectedElementId,
    isDraggingElement,
    dragElementOffset,
    lineEditMode,
    rectangleEditMode,
    isCreatingTextBox,
    showTextInput,
    textInputPosition,
    textInputValue,
    isShiftPressed,
    
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
    setSelectedElementId,
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
  }
}