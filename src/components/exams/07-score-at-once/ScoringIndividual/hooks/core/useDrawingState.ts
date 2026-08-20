import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

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

// データベース統合フックのインポート
import {
  type DrawingPersistenceCallbacks,
  useDrawingAnnotations,
} from "./useDrawingAnnotations"

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
  const [drawingElements, setDrawingElements] = useState<DrawingAnnotation[]>(
    []
  )
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
    isLoading: isLoadingFromDB,
    error: dbError,
    saveElement,
    updateElement,
    deleteElement,
    loadAnnotations,
    syncElements,
  } = useDrawingAnnotations(
    enablePersistence ? persistenceCallbacks : undefined
  )

  // 行き先が変わった時にDBから自動読み込み
  const prevTargetRef = useRef<AnnotationTarget | null | undefined>(undefined)

  // ロードバージョンカウンター：非同期ロードの競合を防止
  // 各ロード開始時にインクリメントし、完了時にバージョンが最新かチェック
  // これによりCRUD操作のsetAnnotationsと完全に分離され、レースコンディションを回避
  const loadVersionRef = useRef(0)

  // 設問変更時の同期的クリア（useLayoutEffectで描画前に確実にクリア）
  // useLayoutEffectは描画effectの前に実行されるため、古いデータで描画されることを防ぐ
  //
  // 行き先は3つのidの組なので、**中身で比べる**。入れ物の同一性で比べると、取り直しの
  // たびに新しい入れ物が来て（＝中身は同じでも）読み込みが走り、描いたばかりの注釈が
  // 一瞬消える
  useLayoutEffect(() => {
    const previousTarget = prevTargetRef.current
    const isSameTarget =
      previousTarget?.examStudentId === annotationTarget?.examStudentId &&
      previousTarget?.cropRegionId === annotationTarget?.cropRegionId &&
      previousTarget?.userId === annotationTarget?.userId
    if (previousTarget === undefined || !isSameTarget) {
      prevTargetRef.current = annotationTarget ?? null

      // 設問変更時は即座にdrawingElementsと選択をクリア
      // useLayoutEffectにより、描画effectが実行される前にクリアが完了する
      setDrawingElements([])
      setSelectedElementIds([])

      // DB読み込みは非同期 → ロード完了時にバージョンチェックで最新のみ適用
      if (enablePersistence && annotationTarget) {
        const thisVersion = ++loadVersionRef.current
        loadAnnotations(annotationTarget).then((annotations) => {
          // stale loadを破棄：より新しいロードが開始されていたら無視
          if (thisVersion !== loadVersionRef.current) return
          setDrawingElements(annotations)
        })
      }
    }
  }, [enablePersistence, annotationTarget, loadAnnotations])

  // 描画要素操作（データベース統合対応）
  const addDrawingElement = useCallback(
    async (element: DrawingAnnotation) => {
      // 行き先が決まっていなければ保存先が無い（答案・設問・採点者のどれかが未確定）
      if (enablePersistence && !annotationTarget) {
        console.error(
          "描画要素の追加には行き先（答案・設問・採点者）が必要です。"
        )
        return
      }

      // ローカル状態を即座に更新
      setDrawingElements((prev) => [...prev, element])

      // データベースへの保存（バックグラウンド）。置き場所の採点行はここで初めて要る
      if (enablePersistence && annotationTarget) {
        try {
          await saveElement(annotationTarget, element)
        } catch (error) {
          console.error("描画要素保存エラー:", error)
          // 保存に失敗した場合、ローカル状態をロールバック
          setDrawingElements((prev) =>
            prev.filter(
              (candidateElement) => candidateElement.id !== element.id
            )
          )
        }
      }
    },
    [enablePersistence, annotationTarget, saveElement]
  )

  const updateDrawingElement = useCallback(
    async (id: string, updates: Partial<DrawingAnnotation>) => {
      let previousElement: DrawingAnnotation | null = null

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
      // 既存アノテーションの更新はアノテーションIDで行うため行き先は不要
      if (enablePersistence && previousElement !== null) {
        const elementToUpdate: DrawingAnnotation = previousElement
        try {
          const updatedElement: DrawingAnnotation = {
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
      updates: Array<{ id: string; updates: Partial<DrawingAnnotation> }>
    ) => {
      const previousElements: Map<string, DrawingAnnotation> = new Map()
      const updateMap = new Map(
        updates.map((update) => [update.id, update.updates])
      )

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
      // 既存アノテーションの更新はアノテーションIDで行うため行き先は不要
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
      let removedElement: DrawingAnnotation | null = null

      // ローカル状態を即座に更新
      setDrawingElements((prev) => {
        removedElement = prev.find((element) => element.id === id) || null
        return prev.filter((element) => element.id !== id)
      })

      // 複数選択からも削除
      setSelectedElementIds((prev) =>
        prev.filter((elementId) => elementId !== id)
      )

      // データベースから削除（バックグラウンド）
      // 既存アノテーションの削除はアノテーションIDで行うため行き先は不要
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
    (element: DrawingAnnotation, rect: SelectionRectangle): boolean => {
      // 要素の境界ボックスを取得
      let elementLeft = element.x
      let elementTop = element.y
      let elementRight = element.x
      let elementBottom = element.y

      switch (element.type) {
        case "line":
          elementLeft = Math.min(element.x, element.endX)
          elementTop = Math.min(element.y, element.endY)
          elementRight = Math.max(element.x, element.endX)
          elementBottom = Math.max(element.y, element.endY)
          break
        case "rectangle":
          elementRight = element.x + element.width
          elementBottom = element.y + element.height
          break
        case "text":
          // テキストボックスの大きさは既定 0.0（＝リサイズされていない）。
          // その場合は小さな矩形として扱う
          if (element.textBoxWidth > 0 && element.textBoxHeight > 0) {
            elementRight = element.x + element.textBoxWidth
            elementBottom = element.y + element.textBoxHeight
          } else {
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
    if (enablePersistence && annotationTarget) {
      try {
        // データベースをクリアする代わりに同期して空配列を送信
        await syncElements([], annotationTarget)
      } catch (error) {
        console.error("全描画クリアエラー:", error)
      }
    }
  }, [enablePersistence, annotationTarget, syncElements])

  // データベース同期関数
  const syncWithDatabase = useCallback(async () => {
    if (!enablePersistence || !annotationTarget) return

    try {
      await syncElements(drawingElements, annotationTarget)
    } catch (error) {
      console.error("データベース同期エラー:", error)
    }
  }, [enablePersistence, annotationTarget, drawingElements, syncElements])

  // データベースから読み込み
  const loadFromDatabase = useCallback(async () => {
    if (!enablePersistence || !annotationTarget) return

    try {
      const thisVersion = ++loadVersionRef.current
      const annotations = await loadAnnotations(annotationTarget)
      // stale loadを破棄
      if (thisVersion !== loadVersionRef.current) return
      setDrawingElements(annotations)
    } catch (error) {
      console.error("データベース読み込みエラー:", error)
    }
  }, [enablePersistence, annotationTarget, loadAnnotations])

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
