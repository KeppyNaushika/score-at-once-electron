/**
 * @fileoverview 統合描画アノテーション管理フック（ScoringIndividual専用）
 * @description 既存描画システムにデータベース永続化を統合
 */

import { useCallback, useEffect, useRef, useState } from "react"

import type {
  DrawingAnnotation,
  DrawingType,
} from "@/types/drawingAnnotation.types"

/**
 * 描画操作のコールバック
 */
export interface DrawingPersistenceCallbacks {
  /** アノテーション作成完了 */
  onAnnotationCreated?: (annotation: DrawingAnnotation) => void
  /** アノテーション更新完了 */
  onAnnotationUpdated?: (annotation: DrawingAnnotation) => void
  /** アノテーション削除完了 */
  onAnnotationDeleted?: (annotationId: string) => void
  /** エラー発生 */
  onError?: (error: string) => void
}

/**
 * フックの戻り値型
 */
interface UseDrawingAnnotationsReturn {
  // 状態
  isLoading: boolean
  error: string | null

  // CRUD操作
  loadAnnotations: (
    questionScoreId: string,
    type?: DrawingType
  ) => Promise<DrawingAnnotation[]>
  saveElement: (element: DrawingAnnotation) => Promise<DrawingAnnotation | null>
  updateElement: (
    element: DrawingAnnotation
  ) => Promise<DrawingAnnotation | null>
  deleteElement: (elementId: string) => Promise<boolean>

  // バッチ操作
  syncElements: (
    elements: DrawingAnnotation[],
    questionScoreId: string
  ) => Promise<DrawingAnnotation[]>
}

/**
 * 統合描画アノテーション管理フック（ScoringIndividual専用）
 */
export function useDrawingAnnotations(
  callbacks?: DrawingPersistenceCallbacks
): UseDrawingAnnotationsReturn {
  // 状態管理
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 参照
  const callbacksRef = useRef<DrawingPersistenceCallbacks>(callbacks || {})

  // コールバック更新
  useEffect(() => {
    callbacksRef.current = callbacks || {}
  }, [callbacks])

  /**
   * エラーハンドリング
   */
  const handleError = useCallback(
    (message: string, originalError?: unknown) => {
      console.error("描画アノテーションエラー:", message, originalError)
      setError(message)
      callbacksRef.current.onError?.(message)
    },
    []
  )

  /**
   * アノテーション読み込み
   * @returns 読み込んだアノテーション配列（失敗時は空配列）
   */
  const loadAnnotations = useCallback(
    async (
      questionScoreId: string,
      type?: DrawingType
    ): Promise<DrawingAnnotation[]> => {
      setIsLoading(true)
      setError(null)

      try {
        // 採点者で絞る余地は無い。QuestionScore は「生徒×設問×採点者」で1行なので、
        // この questionScoreId の注釈は全部同じ採点者のものである
        const result = await window.electronAPI.drawing.getByQuestionScore(
          questionScoreId,
          type
        )
        if (result.success && result.data) {
          return result.data
        } else {
          handleError(result.error || "アノテーション読み込みに失敗しました")
          return []
        }
      } catch (error) {
        handleError("アノテーション読み込み中にエラーが発生しました", error)
        return []
      } finally {
        setIsLoading(false)
      }
    },
    [handleError]
  )

  /**
   * 描画要素保存（新規作成）
   * 行をそのまま渡す。questionScoreId は行に載っている
   */
  const saveElement = useCallback(
    async (element: DrawingAnnotation): Promise<DrawingAnnotation | null> => {
      setIsLoading(true)
      setError(null)

      try {
        // 採点者は渡さない。注釈の持ち主は親 QuestionScore から決まる
        const result = await window.electronAPI.drawing.create(element)

        if (result.success && result.data) {
          callbacksRef.current.onAnnotationCreated?.(result.data!)
          return result.data!
        } else {
          handleError(result.error || "描画要素の保存に失敗しました")
          return null
        }
      } catch (error) {
        handleError("描画要素保存中にエラーが発生しました", error)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [handleError]
  )

  /**
   * 描画要素更新
   */
  const updateElement = useCallback(
    async (element: DrawingAnnotation): Promise<DrawingAnnotation | null> => {
      setIsLoading(true)
      setError(null)

      try {
        // 行をそのまま送り返す。列を選んで詰め替えないので、列を足しても永続化から漏れない
        const result = await window.electronAPI.drawing.update(element)

        if (result.success && result.data) {
          callbacksRef.current.onAnnotationUpdated?.(result.data!)
          return result.data!
        } else {
          handleError(result.error || "描画要素の更新に失敗しました")
          return null
        }
      } catch (error) {
        handleError("描画要素更新中にエラーが発生しました", error)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [handleError]
  )

  /**
   * 描画要素削除
   */
  const deleteElement = useCallback(
    async (elementId: string): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await window.electronAPI.drawing.delete(elementId)

        if (result.success) {
          callbacksRef.current.onAnnotationDeleted?.(elementId)
          return true
        } else {
          handleError(result.error || "描画要素の削除に失敗しました")
          return false
        }
      } catch (error) {
        handleError("描画要素削除中にエラーが発生しました", error)
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [handleError]
  )

  /**
   * タイプ別削除
   */
  const deleteByType = useCallback(
    async (questionScoreId: string, type?: DrawingType): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await window.electronAPI.drawing.deleteByQuestionScore(
          questionScoreId,
          type
        )

        if (result.success) {
          return true
        } else {
          handleError(result.error || "タイプ別削除に失敗しました")
          return false
        }
      } catch (error) {
        handleError("タイプ別削除中にエラーが発生しました", error)
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [handleError]
  )

  /**
   * 描画要素の同期（既存システムからデータベースへ）
   * questionScoreIdは必須（事前にQuestionScoreが作成されている必要がある）
   */
  const syncElements = useCallback(
    async (
      elements: DrawingAnnotation[],
      questionScoreId: string
    ): Promise<DrawingAnnotation[]> => {
      setIsLoading(true)
      setError(null)

      try {
        // 既存のアノテーションをクリア
        await deleteByType(questionScoreId)

        // 新しい要素を一括作成（採点者は親 QuestionScore から決まる）
        const result = await window.electronAPI.drawing.batchCreate(elements)

        if (result.success && result.data) {
          return result.data
        } else {
          handleError(result.error || "描画要素の同期に失敗しました")
          return []
        }
      } catch (error) {
        handleError("描画要素同期中にエラーが発生しました", error)
        return []
      } finally {
        setIsLoading(false)
      }
    },
    [handleError, deleteByType]
  )

  return {
    // 状態
    isLoading,
    error,

    // CRUD操作
    loadAnnotations,
    saveElement,
    updateElement,
    deleteElement,

    // バッチ操作
    syncElements,
  }
}
