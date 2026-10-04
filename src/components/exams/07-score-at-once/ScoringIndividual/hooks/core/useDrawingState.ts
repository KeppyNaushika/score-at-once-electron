import { useCallback, useState } from "react"

import { DEFAULT_DRAWING_SETTINGS } from "@/components/exams/07-score-at-once/ScoringIndividual/constants/drawingConstants"
import type {
  CanvasTool,
  DrawingActions,
  DrawingState,
  LineEditMode,
  RectangleEditMode,
  SelectionRectangle,
} from "@/components/exams/07-score-at-once/ScoringIndividual/types"
import type {
  AnnotationTarget,
  DrawingAnnotation,
  LineStyle,
} from "@/types/drawingAnnotation.types"

import { isElementInRectangle } from "../../utils/isElementInRectangle"
import { usePersistedDrawingElements } from "./usePersistedDrawingElements"

/**
 * 拡張された描画状態フック（データベース統合対応）
 *
 * `annotationTarget` は注釈の行き先（答案＋設問＋採点者）。**置き場所の採点行は
 * 持たない。** 保存のときに main が用意するので、キャンバスは描くことだけを担う。
 */
export function useDrawingState(
  annotationTarget?: AnnotationTarget | null,
  enablePersistence: boolean = true,
  onAnnotationChanged?: () => void
): DrawingState &
  DrawingActions & {
    // データベース統合機能
    isLoadingFromDB: boolean
    dbError: string | null
    syncWithDatabase: () => Promise<void>
    loadFromDatabase: () => Promise<void>
  } {
  // 基本的な描画設定
  const [currentTool, setCurrentTool] = useState<CanvasTool>("hand")
  const [strokeColor, setStrokeColor] = useState(
    DEFAULT_DRAWING_SETTINGS.strokeColor
  )
  const [strokeWidth, setStrokeWidth] = useState(
    DEFAULT_DRAWING_SETTINGS.strokeWidth
  )
  const [lineStyle, setLineStyle] = useState<LineStyle>(
    DEFAULT_DRAWING_SETTINGS.lineStyle
  )
  const [fontSize, setFontSize] = useState(DEFAULT_DRAWING_SETTINGS.fontSize)

  // 描画要素とステート
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentDrawing, setCurrentDrawing] =
    useState<Partial<DrawingAnnotation> | null>(null)

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

  // テキスト再編集
  const [isEditingExistingText, setIsEditingExistingText] = useState(false)
  const [editingTextElementId, setEditingTextElementId] = useState<
    string | null
  >(null)

  // キーボード状態
  const [isShiftPressed, setIsShiftPressed] = useState(false)
  const [isCtrlPressed, setIsCtrlPressed] = useState(false)

  // ホバー中の要素（端点表示用）
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null)

  // 描画要素とDBへの永続化
  const {
    drawingElements,
    setDrawingElements,
    addDrawingElement,
    updateDrawingElement,
    updateDrawingElements,
    removeDrawingElement,
    clearAllElements,
    isLoadingFromDB,
    dbError,
    syncWithDatabase,
    loadFromDatabase,
  } = usePersistedDrawingElements({
    annotationTarget,
    enablePersistence,
    onAnnotationChanged,
    setSelectedElementIds,
  })

  // 複数選択操作
  const addToSelection = useCallback((id: string) => {
    setSelectedElementIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const removeFromSelection = useCallback((id: string) => {
    setSelectedElementIds((prev) =>
      prev.filter((elementId) => elementId !== id)
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

  const selectElementsInRectangle = useCallback(
    (rect: SelectionRectangle) => {
      const elementsInRect = drawingElements
        .filter((element) => isElementInRectangle(element, rect))
        .map((element) => element.id)

      if (elementsInRect.length > 0) {
        setSelectedElementIds(elementsInRect)
      }
    },
    [drawingElements]
  )

  const clearDrawing = useCallback(async () => {
    // ローカル状態をクリア
    setSelectedElementIds([])
    setCurrentDrawing(null)
    setIsDrawing(false)
    setIsDrawingSelection(false)
    setSelectionRectangle(null)

    // 描画要素は手元とDBの両方を空にする
    await clearAllElements()
  }, [clearAllElements])

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
    // テキスト再編集
    isEditingExistingText,
    editingTextElementId,
    isShiftPressed,
    isCtrlPressed,
    isDraggingHandle,
    currentHandle,
    hoveredElementId,

    // Actions
    setCurrentTool,
    setStrokeColor: setStrokeColor as (color: string) => void,
    setStrokeWidth: setStrokeWidth as (width: number) => void,
    setLineStyle,
    setFontSize: setFontSize as (size: number) => void,
    setDrawingElements,
    addDrawingElement,
    updateDrawingElement,
    updateDrawingElements,
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
    // テキスト再編集用
    setIsEditingExistingText,
    setEditingTextElementId,
    setIsShiftPressed,
    setIsCtrlPressed,
    setIsDraggingHandle,
    setCurrentHandle,
    setHoveredElementId,

    // データベース統合機能
    isLoadingFromDB,
    dbError,
    syncWithDatabase,
    loadFromDatabase,
  }
}
