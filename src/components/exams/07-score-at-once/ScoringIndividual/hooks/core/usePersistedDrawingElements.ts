/**
 * @fileoverview 描画要素の状態とDBへの永続化
 * 手元の状態を先に変え、DBへの書き込みはその後ろで行う（失敗したら手元を戻す）。
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import type {
  AnnotationTarget,
  DrawingAnnotation,
} from "@/types/drawingAnnotation.types"

import type { DraftAnnotationsSource } from "../../types"
// データベース統合フックのインポート
import {
  type DrawingPersistenceCallbacks,
  useDrawingAnnotations,
} from "./useDrawingAnnotations"

interface UsePersistedDrawingElementsParams {
  /** 注釈の行き先（答案＋設問＋採点者） */
  annotationTarget: AnnotationTarget | null | undefined
  enablePersistence: boolean
  onAnnotationChanged: (() => void) | undefined
  /** 選択中の要素（行き先が変わったとき・要素を消したときに外す） */
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>
  /**
   * 保存しない下書き。渡すと要素はここの状態になり、行き先が変わっても空にせず
   * DB からも読まない（書かないのは enablePersistence を false にして決める）
   */
  draftAnnotations?: DraftAnnotationsSource
}

/**
 * 描画要素の状態と、その追加・更新・削除（DB統合）
 *
 * 行き先が変わったら手元を空にし、DBから読み直す。
 */
export function usePersistedDrawingElements({
  annotationTarget,
  enablePersistence,
  onAnnotationChanged,
  setSelectedElementIds,
  draftAnnotations,
}: UsePersistedDrawingElementsParams) {
  const [ownDrawingElements, setOwnDrawingElements] = useState<
    DrawingAnnotation[]
  >([])
  // 下書きがあれば要素は呼び出し側の状態（setter は useState のものなので参照は安定）
  const drawingElements = draftAnnotations?.elements ?? ownDrawingElements
  const setDrawingElements =
    draftAnnotations?.setElements ?? setOwnDrawingElements
  const isDraft = draftAnnotations !== undefined

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
      // （下書きは呼び出し側の状態なので消さない）
      if (!isDraft) setDrawingElements([])
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
  }, [
    enablePersistence,
    annotationTarget,
    loadAnnotations,
    setSelectedElementIds,
    isDraft,
    setDrawingElements,
  ])

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
    [enablePersistence, annotationTarget, saveElement, setDrawingElements]
  )

  /**
   * 1つの要素を更新する。
   *
   * **更新前の行は setState の updater の外で引く。** updater は React が呼ぶかどうかを
   * 決める純粋な関数で、保留中の更新があるときはその場では走らない。updater の中で
   * 外の変数へ控えていた頃は、同じティックで2回目以降に呼ばれた更新が「前の行が無い」
   * と判断されて DB へ1回も届かなかった（＝移動したのに元の位置のまま保存される）。
   * 移動はポインタが動くたびに呼ばれるので、これは常に起きうる。
   *
   * ただし引く元はレンダー時点の行なので、**同じティックで同じ要素の別の列を
   * 更新すると、後の呼び出しが前の分を打ち消す**（後勝ち）。1つの操作で複数の列を
   * 動かすときは、呼び分けずに1回の `updates` へまとめること。
   */
  const updateDrawingElement = useCallback(
    async (id: string, updates: Partial<DrawingAnnotation>) => {
      const previousElement =
        drawingElements.find((element) => element.id === id) ?? null

      // ローカル状態を即座に更新
      setDrawingElements((prev) =>
        prev.map((element) =>
          element.id === id ? { ...element, ...updates } : element
        )
      )

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
    [drawingElements, enablePersistence, updateElement, setDrawingElements]
  )

  // 複数要素を一括更新（1回のsetStateで全て更新）。
  // 更新前の行を updater の外で引く理由は updateDrawingElement と同じ
  const updateDrawingElements = useCallback(
    async (
      updates: Array<{ id: string; updates: Partial<DrawingAnnotation> }>
    ) => {
      const updateMap = new Map(
        updates.map((update) => [update.id, update.updates])
      )
      const previousElements = new Map(
        drawingElements
          .filter((element) => updateMap.has(element.id))
          .map((element) => [element.id, element])
      )

      // ローカル状態を即座に更新（1回のsetStateで全て更新）
      setDrawingElements((prev) =>
        prev.map((element) => {
          const elementUpdates = updateMap.get(element.id)
          return elementUpdates ? { ...element, ...elementUpdates } : element
        })
      )

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
              // 失敗した要素だけ元へ戻す（ほかの要素は保存できている）
              setDrawingElements((prev) =>
                prev.map((element) =>
                  element.id === id ? previousElement : element
                )
              )
            }
          }
        }
      }
    },
    [drawingElements, enablePersistence, updateElement, setDrawingElements]
  )

  const removeDrawingElement = useCallback(
    async (id: string) => {
      // 消す前の行も updater の外で引く（updateDrawingElement と同じ理由。
      // ここで取り逃すと、削除に失敗したときに戻す先が無くなる）
      const removedElement =
        drawingElements.find((element) => element.id === id) ?? null

      // ローカル状態を即座に更新
      setDrawingElements((prev) => prev.filter((element) => element.id !== id))

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
            setDrawingElements((prev) => [...prev, removedElement])
          }
        }
      }
    },
    [
      drawingElements,
      enablePersistence,
      deleteElement,
      setSelectedElementIds,
      setDrawingElements,
    ]
  )

  /** 全要素を消す（DBも空にする。失敗したら手元を戻す） */
  const clearAllElements = useCallback(async () => {
    // 消す前の要素を控える（全消去に失敗したら戻す）
    const clearedElements = drawingElements

    setDrawingElements([])

    // データベースからも全削除（バックグラウンド）
    if (enablePersistence && annotationTarget) {
      try {
        // データベースをクリアする代わりに同期して空配列を送信
        await syncElements([], annotationTarget)
      } catch (error) {
        console.error("全描画クリアエラー:", error)
        setDrawingElements(clearedElements)
      }
    }
  }, [
    drawingElements,
    enablePersistence,
    annotationTarget,
    syncElements,
    setDrawingElements,
  ])

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
  }, [enablePersistence, annotationTarget, loadAnnotations, setDrawingElements])

  return {
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
  }
}
