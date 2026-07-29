/**
 * @fileoverview 統合描画アノテーション管理フック（ScoringIndividual専用）
 * @description 既存描画システムにデータベース永続化を統合
 */

import { useCallback, useEffect, useRef, useState } from "react"

import type {
  DrawingAnnotation,
  DrawingCreateData,
  DrawingType,
  DrawingUpdateData,
} from "@/types/drawingAnnotation.types"

// 既存の描画システム型と互換性を保つため
import type { DrawingElement } from "../../types"

// QuestionScore自動作成用のコンテキスト情報
interface DrawingContext {
  currentExamStudentId?: string
  currentCropRegionId?: string
  currentUserId?: string
}

/**
 * 既存DrawingElementからDrawingCreateDataへの変換
 * questionScoreIdは必須（事前にQuestionScoreが作成されている必要がある）
 * @throws Error questionScoreIdがない場合
 */
function convertElementToCreateData(
  element: DrawingElement,
  questionScoreId: string,
  userId: string
): DrawingCreateData {
  return {
    id: element.id, // フロントエンドで生成したUUIDをDBでも使用
    questionScoreId,
    type: element.type as DrawingType,
    x: element.x,
    y: element.y,
    color: element.color,
    strokeWidth: element.strokeWidth,
    ...(element.width !== undefined && { width: element.width }),
    ...(element.height !== undefined && { height: element.height }),
    ...(element.endX !== undefined && { endX: element.endX }),
    ...(element.endY !== undefined && { endY: element.endY }),
    ...(element.lineStyle && { lineStyle: element.lineStyle }),
    ...(element.text && { text: element.text }),
    ...(element.fontSize && { fontSize: element.fontSize }),
    ...(element.textBoxWidth && { textBoxWidth: element.textBoxWidth }),
    ...(element.textBoxHeight && { textBoxHeight: element.textBoxHeight }),
    ...(element.displayX !== undefined && { displayX: element.displayX }),
    ...(element.displayY !== undefined && { displayY: element.displayY }),
    ...(element.anchorDirection && {
      anchorDirection: element.anchorDirection,
    }),
    horizontalAlign: "left", // デフォルト値
    verticalAlign: "top", // デフォルト値
    userId,
  }
}

/**
 * DrawingAnnotationから既存DrawingElementへの変換
 */
export function convertAnnotationToElement(
  annotation: DrawingAnnotation
): DrawingElement {
  return {
    id: annotation.id,
    type: annotation.type as DrawingElement["type"],
    x: annotation.x,
    y: annotation.y,
    color: annotation.color,
    strokeWidth: annotation.strokeWidth,
    width: annotation.width,
    height: annotation.height,
    endX: annotation.endX,
    endY: annotation.endY,
    lineStyle: annotation.lineStyle,
    text: annotation.text,
    fontSize: annotation.fontSize,
    textBoxWidth: annotation.textBoxWidth,
    textBoxHeight: annotation.textBoxHeight,
    displayX: annotation.displayX,
    displayY: annotation.displayY,
    anchorDirection:
      annotation.anchorDirection as DrawingElement["anchorDirection"],
  }
}

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
  saveElement: (
    element: DrawingElement,
    questionScoreId: string
  ) => Promise<DrawingAnnotation | null>
  updateElement: (element: DrawingElement) => Promise<DrawingAnnotation | null>
  deleteElement: (elementId: string) => Promise<boolean>

  // バッチ操作
  syncElements: (
    elements: DrawingElement[],
    questionScoreId: string
  ) => Promise<DrawingAnnotation[]>
}

/**
 * 統合描画アノテーション管理フック（ScoringIndividual専用）
 */
export function useDrawingAnnotations(
  callbacks?: DrawingPersistenceCallbacks,
  context?: DrawingContext
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
   * contextのcurrentUserIdを使って、ログインユーザーのアノテーションのみ取得
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
        const result = await window.electronAPI.drawing.getByQuestionScore(
          questionScoreId,
          type,
          context?.currentUserId
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
    [handleError, context?.currentUserId]
  )

  /**
   * 描画要素保存（新規作成）
   * questionScoreIdは必須（事前にQuestionScoreが作成されている必要がある）
   */
  const saveElement = useCallback(
    async (
      element: DrawingElement,
      questionScoreId: string
    ): Promise<DrawingAnnotation | null> => {
      setIsLoading(true)
      setError(null)

      // userIdがない場合はエラー
      if (!context?.currentUserId) {
        handleError("ユーザーIDが設定されていません")
        setIsLoading(false)
        return null
      }

      try {
        const createData = convertElementToCreateData(
          element,
          questionScoreId,
          context.currentUserId
        )
        const result = await window.electronAPI.drawing.create(createData)

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
    [handleError, context]
  )

  /**
   * 描画要素更新
   */
  const updateElement = useCallback(
    async (element: DrawingElement): Promise<DrawingAnnotation | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const updateData: DrawingUpdateData = {
          x: element.x,
          y: element.y,
          color: element.color,
          strokeWidth: element.strokeWidth,
          width: element.width,
          height: element.height,
          endX: element.endX,
          endY: element.endY,
          lineStyle: element.lineStyle,
          text: element.text,
          fontSize: element.fontSize,
          textBoxWidth: element.textBoxWidth,
          textBoxHeight: element.textBoxHeight,
          displayX: element.displayX,
          displayY: element.displayY,
          anchorDirection: element.anchorDirection, // アンカー方向の永続化
        }

        const result = await window.electronAPI.drawing.update(
          element.id,
          updateData
        )

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
      elements: DrawingElement[],
      questionScoreId: string
    ): Promise<DrawingAnnotation[]> => {
      setIsLoading(true)
      setError(null)

      // userIdがない場合はエラー
      if (!context?.currentUserId) {
        handleError("ユーザーIDが設定されていません")
        setIsLoading(false)
        return []
      }

      try {
        // 既存のアノテーションをクリア
        await deleteByType(questionScoreId)

        // 新しい要素を一括作成
        const createDataList = elements.map((element) =>
          convertElementToCreateData(
            element,
            questionScoreId,
            context.currentUserId!
          )
        )

        const result =
          await window.electronAPI.drawing.batchCreate(createDataList)

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
    [handleError, deleteByType, context]
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
