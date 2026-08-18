/**
 * @fileoverview 統合描画アノテーション管理フック（ScoringIndividual専用）
 * @description 既存描画システムにデータベース永続化を統合
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  annotationsByQuestionScoreQuery,
  batchCreateAnnotationsMutation,
  createAnnotationMutation,
  deleteAnnotationMutation,
  deleteAnnotationsByQuestionScoreMutation,
  updateAnnotationMutation,
} from "@/queries/drawing"
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
 *
 * 描いている最中の要素はキャンバス側の state が持つ（`useDrawingState`）。
 * ここは**ストロークが終わった時点の1回**を DB へ渡すだけを担う。
 */
export function useDrawingAnnotations(
  callbacks?: DrawingPersistenceCallbacks
): UseDrawingAnnotationsReturn {
  const queryClient = useQueryClient()
  const createAnnotation = useMutation(createAnnotationMutation())
  const updateAnnotation = useMutation(updateAnnotationMutation())
  const deleteAnnotation = useMutation(deleteAnnotationMutation())
  const batchCreateAnnotations = useMutation(batchCreateAnnotationsMutation())
  const deleteByQuestionScore = useMutation(
    deleteAnnotationsByQuestionScoreMutation()
  )

  const { mutateAsync: createOne } = createAnnotation
  const { mutateAsync: updateOne } = updateAnnotation
  const { mutateAsync: deleteOne } = deleteAnnotation
  const { mutateAsync: createMany } = batchCreateAnnotations
  const { mutateAsync: deleteAllOfQuestionScore } = deleteByQuestionScore

  // 参照
  const callbacksRef = useRef<DrawingPersistenceCallbacks>(callbacks || {})

  // コールバック更新
  useEffect(() => {
    callbacksRef.current = callbacks || {}
  }, [callbacks])

  /**
   * 読み込みの進行と失敗。
   *
   * 読み込みは命令的（`fetchQuery`）なので、`useQuery` の結果として出てこない。
   * `isLoading` / `error` が読み込みも覆っていたのは元の形が持っていた性質なので、
   * ここで持ち直す（呼び出し側はこの2つで待ちと失敗表示を出している）。
   */
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)

  const isLoading =
    reading ||
    createAnnotation.isPending ||
    updateAnnotation.isPending ||
    deleteAnnotation.isPending ||
    batchCreateAnnotations.isPending ||
    deleteByQuestionScore.isPending

  /**
   * アノテーション読み込み
   *
   * 呼び出し側（`useDrawingState`）が設問の切り替えに合わせて命令的に読むので、
   * キャッシュ経由でその場で取る（`fetchQuery`）。取れた行はキャッシュにも載るので、
   * 同じ設問を続けて開いても往復は増えない。
   *
   * @returns 読み込んだアノテーション配列（失敗時は空配列）
   */
  const loadAnnotations = useCallback(
    async (
      questionScoreId: string,
      type?: DrawingType
    ): Promise<DrawingAnnotation[]> => {
      setReading(true)
      setReadError(null)
      try {
        // 採点者で絞る余地は無い。QuestionScore は「生徒×設問×採点者」で1行なので、
        // この questionScoreId の注釈は全部同じ採点者のものである
        return await queryClient.fetchQuery(
          annotationsByQuestionScoreQuery(questionScoreId, type)
        )
      } catch (error) {
        console.error("アノテーション読み込みエラー:", error)
        const message = "アノテーション読み込み中にエラーが発生しました"
        setReadError(message)
        callbacksRef.current.onError?.(message)
        return []
      } finally {
        setReading(false)
      }
    },
    [queryClient]
  )

  /**
   * 描画要素保存（新規作成）
   * 行をそのまま渡す。questionScoreId は行に載っている
   */
  const saveElement = useCallback(
    async (element: DrawingAnnotation): Promise<DrawingAnnotation | null> => {
      try {
        // 採点者は渡さない。注釈の持ち主は親 QuestionScore から決まる
        const created = await createOne(element)
        callbacksRef.current.onAnnotationCreated?.(created)
        return created
      } catch {
        // 失敗の通知は MutationCache の後始末が出す
        return null
      }
    },
    [createOne]
  )

  /**
   * 描画要素更新
   */
  const updateElement = useCallback(
    async (element: DrawingAnnotation): Promise<DrawingAnnotation | null> => {
      try {
        // 行をそのまま送り返す。列を選んで詰め替えないので、列を足しても永続化から漏れない
        const updated = await updateOne(element)
        callbacksRef.current.onAnnotationUpdated?.(updated)
        return updated
      } catch {
        return null
      }
    },
    [updateOne]
  )

  /**
   * 描画要素削除
   */
  const deleteElement = useCallback(
    async (elementId: string): Promise<boolean> => {
      try {
        await deleteOne(elementId)
        callbacksRef.current.onAnnotationDeleted?.(elementId)
        return true
      } catch {
        return false
      }
    },
    [deleteOne]
  )

  /**
   * 描画要素の同期（既存システムからデータベースへ）
   *
   * 「今キャンバスに載っている要素をこの設問の注釈にする」という1つの意図なので、
   * 消してから作る。questionScoreId は必須（事前に QuestionScore が要る）。
   */
  const syncElements = useCallback(
    async (
      elements: DrawingAnnotation[],
      questionScoreId: string
    ): Promise<DrawingAnnotation[]> => {
      try {
        // 削除と作成を**続けて積む**（間で待たない）。`scope` が実行の順序を
        // 保つので消してから作る順は変わらず、両方が pending のあいだは
        // 取り直しが畳まれる。待ってから作ると、削除の直後に「空になった DB」を
        // 読みに行く取り直しが走り、注釈が一瞬消えて戻るのが見える
        const deletion = deleteAllOfQuestionScore({ questionScoreId })
        const creation =
          elements.length > 0
            ? createMany(elements)
            : Promise.resolve<DrawingAnnotation[]>([])

        await deletion
        return await creation
      } catch {
        return []
      }
    },
    [createMany, deleteAllOfQuestionScore]
  )

  return {
    // 状態
    isLoading,
    error:
      readError ??
      createAnnotation.error?.message ??
      updateAnnotation.error?.message ??
      deleteAnnotation.error?.message ??
      batchCreateAnnotations.error?.message ??
      deleteByQuestionScore.error?.message ??
      null,

    // CRUD操作
    loadAnnotations,
    saveElement,
    updateElement,
    deleteElement,

    // バッチ操作
    syncElements,
  }
}
