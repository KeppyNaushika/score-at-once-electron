/**
 * @fileoverview 設問表示時にQuestionScoreを自動作成するフック
 * @description 設問を表示した際にQuestionScoreが存在しない場合、unscoredステータスで自動作成
 */

import { useCallback, useEffect, useRef } from "react"

export interface UseAutoCreateQuestionScoreParams {
  /** 現在の生徒ID */
  currentStudentId?: string
  /** 現在の設問領域ID */
  currentCropRegionId?: string
  /** 現在のユーザーID */
  currentUserId?: string
  /** QuestionScore配列（既存のスコアを検索用） */
  questionScores?: Array<{
    id: string
    studentId: string
    cropRegionId: string
  }>
  /** QuestionScore作成後のコールバック（リストの更新用） */
  onQuestionScoreCreated?: () => void
}

export interface UseAutoCreateQuestionScoreReturn {
  /** 現在のQuestionScoreのID（存在しない場合はnull） */
  currentQuestionScoreId: string | null
}

/**
 * 設問表示時にQuestionScoreを自動作成するフック
 */
export function useAutoCreateQuestionScore({
  currentStudentId,
  currentCropRegionId,
  currentUserId,
  questionScores,
  onQuestionScoreCreated,
}: UseAutoCreateQuestionScoreParams): UseAutoCreateQuestionScoreReturn {
  // 作成中のリクエストを追跡（重複作成防止）
  const creatingRef = useRef<string | null>(null)

  // 現在のQuestionScoreを検索
  const currentQuestionScoreId =
    questionScores?.find(
      (questionScore) =>
        questionScore.studentId === currentStudentId &&
        questionScore.cropRegionId === currentCropRegionId
    )?.id ?? null

  // QuestionScore作成関数
  const createQuestionScore = useCallback(async () => {
    if (!currentStudentId || !currentCropRegionId || !currentUserId) {
      return
    }

    const key = `${currentStudentId}-${currentCropRegionId}-${currentUserId}`

    // 既に作成中の場合はスキップ
    if (creatingRef.current === key) {
      return
    }

    creatingRef.current = key

    try {
      const result = await window.electronAPI.createQuestionScore({
        studentId: currentStudentId,
        cropRegionId: currentCropRegionId,
        userId: currentUserId,
        status: "unscored",
        partialScore: undefined,
      })

      if (result.success) {
        // 作成成功 - 親コンポーネントに通知してリストを更新
        onQuestionScoreCreated?.()
      } else {
        console.error("QuestionScore作成失敗:", result.error)
      }
    } catch (error) {
      console.error("QuestionScore作成エラー:", error)
    } finally {
      // 作成完了後にリセット（別の設問に移動可能にする）
      if (creatingRef.current === key) {
        creatingRef.current = null
      }
    }
  }, [
    currentStudentId,
    currentCropRegionId,
    currentUserId,
    onQuestionScoreCreated,
  ])

  // 設問表示時にQuestionScoreが存在しない場合は自動作成
  useEffect(() => {
    if (
      currentStudentId &&
      currentCropRegionId &&
      currentUserId &&
      currentQuestionScoreId === null
    ) {
      createQuestionScore()
    }
  }, [
    currentStudentId,
    currentCropRegionId,
    currentUserId,
    currentQuestionScoreId,
    createQuestionScore,
  ])

  return {
    currentQuestionScoreId,
  }
}
