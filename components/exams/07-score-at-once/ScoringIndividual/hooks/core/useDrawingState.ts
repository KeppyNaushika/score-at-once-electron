import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import { DEFAULT_DRAWING_SETTINGS } from "@/components/exams/07-score-at-once/ScoringIndividual/constants/drawingConstants"
import type {
  DrawingActions,
  DrawingElement,
  DrawingState,
  DrawingTool,
  LineEditMode,
  LineStyle,
  RectangleEditMode,
  SelectionRectangle,
} from "@/components/exams/07-score-at-once/ScoringIndividual/types/answerIndividualTypes"

// データベース統合フックのインポート
import {
  convertAnnotationToElement,
  type DrawingPersistenceCallbacks,
  useDrawingAnnotations,
} from "./useDrawingAnnotations"

/**
 * 拡張された描画状態フック（データベース統合対応）
 */
export function useDrawingState(
  questionScoreId?: string | null,
  enablePersistence: boolean = true,
  context?: {
    currentStudentId?: string
    currentCropRegionId?: string
    currentUserId?: string
  },
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
  const [currentTool, setCurrentTool] = useState<DrawingTool>("hand")
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

  // onAnnotationChangedのref（コールバック変更でフックが再作成されないようにする）
  const onAnnotationChangedRef = useRef(onAnnotationChanged)
  useEffect(() => {
    onAnnotationChangedRef.current = onAnnotationChanged
  }, [onAnnotationChanged])

  // データベース統合フック
  const persistenceCallbacks: DrawingPersistenceCallbacks = {
    onAnnotationCreated: () => {
      onAnnotationChangedRef.current?.()
    },
    onAnnotationUpdated: () => {
      onAnnotationChangedRef.current?.()
    },
    onAnnotationDeleted: () => {
      onAnnotationChangedRef.current?.()
    },
    onError: (error) => {
      console.error("データベース操作エラー:", error)
    },
  }

  const {
    annotations,
    isLoading: isLoadingFromDB,
    error: dbError,
    saveElement,
    updateElement,
    deleteElement,
    loadAnnotations,
    syncElements,
  } = useDrawingAnnotations(
    enablePersistence ? persistenceCallbacks : undefined,
    context
  )

  // questionScoreIdが変更された時にDBから自動読み込み
  const prevQuestionScoreIdRef = useRef<string | null | undefined>(undefined)
  const isInitialLoadRef = useRef(true)

  // 設問変更時の同期的クリア（useLayoutEffectで描画前に確実にクリア）
  // useLayoutEffectは描画effectの前に実行されるため、古いデータで描画されることを防ぐ
  useLayoutEffect(() => {
    if (prevQuestionScoreIdRef.current !== questionScoreId) {
      prevQuestionScoreIdRef.current = questionScoreId

      // 設問変更時は即座にdrawingElementsと選択をクリア
      // useLayoutEffectにより、描画effectが実行される前にクリアが完了する

      setDrawingElements([])
      setSelectedElementIds([])

      // DB読み込みは非同期なので、ここでは開始のみ
      if (enablePersistence && questionScoreId) {
        loadAnnotations(questionScoreId)
      }
    }
  }, [enablePersistence, questionScoreId, loadAnnotations])

  // annotationsが更新されたらdrawingElementsに反映
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      return
    }

    // annotationsをdrawingElementsに変換（同期的に更新）
    const elements = annotations.map(convertAnnotationToElement)

    setDrawingElements(elements)
  }, [annotations])

  // 描画要素操作（データベース統合対応）
  const addDrawingElement = useCallback(
    async (element: DrawingElement) => {
      // questionScoreIdがない場合は追加できない
      // （QuestionScoreは設問表示時に自動作成されるはず）
      if (enablePersistence && !questionScoreId) {
        console.error(
          "描画要素の追加には QuestionScore が必要です。設問表示時に自動作成されるまでお待ちください。"
        )
        return
      }

      // ローカル状態を即座に更新
      setDrawingElements((prev) => [...prev, element])

      // データベースへの保存（バックグラウンド）
      if (enablePersistence && questionScoreId) {
        try {
          await saveElement(element, questionScoreId)
        } catch (error) {
          console.error("描画要素保存エラー:", error)
          // 保存に失敗した場合、ローカル状態をロールバック
          setDrawingElements((prev) => prev.filter((e) => e.id !== element.id))
        }
      }
    },
    [enablePersistence, questionScoreId, saveElement]
  )

  const updateDrawingElement = useCallback(
    async (id: string, updates: Partial<DrawingElement>) => {
      let previousElement: DrawingElement | null = null

      // ローカル状態を即座に更新
      setDrawingElements((prev) => {
        const updated = prev.map((element) => {
          if (element.id === id) {
            previousElement = element
            return { ...element, ...updates }
          }
          return element
        })
        return updated
      })

      // データベース更新（バックグラウンド）
      // 既存アノテーションの更新はアノテーションIDで行うためquestionScoreIdは不要
      if (enablePersistence && previousElement !== null) {
        const elementToUpdate: DrawingElement = previousElement
        try {
          const updatedElement: DrawingElement = {
            ...elementToUpdate,
            ...updates,
          }
          await updateElement(updatedElement)
        } catch (error) {
          console.error("描画要素更新エラー:", error)
          // 更新に失敗した場合、ローカル状態をロールバック
          setDrawingElements((prev) =>
            prev.map((element) =>
              element.id === id ? elementToUpdate : element
            )
          )
        }
      }
    },
    [enablePersistence, updateElement]
  )

  // 複数要素を一括更新（1回のsetStateで全て更新）
  const updateDrawingElements = useCallback(
    async (
      updates: Array<{ id: string; updates: Partial<DrawingElement> }>
    ) => {
      const previousElements: Map<string, DrawingElement> = new Map()
      const updateMap = new Map(updates.map((u) => [u.id, u.updates]))

      // ローカル状態を即座に更新（1回のsetStateで全て更新）
      setDrawingElements((prev) => {
        return prev.map((element) => {
          const elementUpdates = updateMap.get(element.id)
          if (elementUpdates) {
            previousElements.set(element.id, element)
            return { ...element, ...elementUpdates }
          }
          return element
        })
      })

      // データベース更新（バックグラウンド、各要素を個別に更新）
      // 既存アノテーションの更新はアノテーションIDで行うためquestionScoreIdは不要
      if (enablePersistence) {
        for (const { id, updates: elementUpdates } of updates) {
          const previousElement = previousElements.get(id)
          if (previousElement) {
            try {
              const updatedElement = { ...previousElement, ...elementUpdates }
              await updateElement(updatedElement)
            } catch (error) {
              console.error("描画要素更新エラー:", error)
            }
          }
        }
      }
    },
    [enablePersistence, updateElement]
  )

  const removeDrawingElement = useCallback(
    async (id: string) => {
      let removedElement: DrawingElement | null = null

      // ローカル状態を即座に更新
      setDrawingElements((prev) => {
        removedElement = prev.find((e) => e.id === id) || null
        return prev.filter((element) => element.id !== id)
      })

      // 複数選択からも削除
      setSelectedElementIds((prev) =>
        prev.filter((elementId) => elementId !== id)
      )

      // データベースから削除（バックグラウンド）
      // 既存アノテーションの削除はアノテーションIDで行うためquestionScoreIdは不要
      if (enablePersistence) {
        try {
          await deleteElement(id)
        } catch (error) {
          console.error("描画要素削除エラー:", error)
          // 削除に失敗した場合、ローカル状態をロールバック
          if (removedElement) {
            setDrawingElements((prev) => [...prev, removedElement!])
          }
        }
      }
    },
    [enablePersistence, deleteElement]
  )

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
    []
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
    [drawingElements, isElementInRectangle]
  )

  const clearDrawing = useCallback(async () => {
    // ローカル状態をクリア
    setDrawingElements([])
    setSelectedElementIds([])
    setCurrentDrawing(null)
    setIsDrawing(false)
    setIsDrawingSelection(false)
    setSelectionRectangle(null)

    // データベースからも全削除（バックグラウンド）
    if (enablePersistence && questionScoreId) {
      try {
        // データベースをクリアする代わりに同期して空配列を送信
        await syncElements([], questionScoreId)
      } catch (error) {
        console.error("全描画クリアエラー:", error)
      }
    }
  }, [enablePersistence, questionScoreId, syncElements])

  // データベース同期関数
  const syncWithDatabase = useCallback(async () => {
    if (!enablePersistence || !questionScoreId) return

    try {
      await syncElements(drawingElements, questionScoreId)
    } catch (error) {
      console.error("データベース同期エラー:", error)
    }
  }, [enablePersistence, questionScoreId, drawingElements, syncElements])

  // データベースから読み込み
  const loadFromDatabase = useCallback(async () => {
    if (!enablePersistence || !questionScoreId) return

    try {
      await loadAnnotations(questionScoreId)
    } catch (error) {
      console.error("データベース読み込みエラー:", error)
    }
  }, [enablePersistence, questionScoreId, loadAnnotations])

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
    setIsCreatingTextBox,
    setShowTextInput,
    setTextInputPosition,
    setTextInputValue,
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
