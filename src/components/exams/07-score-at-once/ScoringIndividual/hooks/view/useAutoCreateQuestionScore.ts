/**
 * @fileoverview 設問表示時にQuestionScoreを自動作成するフック
 * @description 設問を表示した際にQuestionScoreが存在しない場合、unscoredステータスで自動作成
 */

import { useMutation } from "@tanstack/react-query"
import { useCallback, useEffect, useRef } from "react"

import { findQuestionScore } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { ensureQuestionScoreMutation } from "@/queries/scoring"

interface UseAutoCreateQuestionScoreParams {
  /** 試験ID（書き込みの行き先を決める） */
  examId: string
  /** 現在の生徒ID */
  currentExamStudentId?: string
  /** 現在の設問領域（採点行を子として持つ） */
  currentCropRegion?: QuestionAnswerRegionRow | null
  /** 現在のユーザーID */
  currentUserId?: string
  /** QuestionScore作成後のコールバック（リストの更新用） */
  onQuestionScoreCreated?: () => void
}

interface UseAutoCreateQuestionScoreReturn {
  /** 現在のQuestionScoreのID（存在しない場合はnull） */
  currentQuestionScoreId: string | null
}

/**
 * 設問表示時にQuestionScoreを自動作成するフック
 */
export function useAutoCreateQuestionScore({
  examId,
  currentExamStudentId,
  currentCropRegion,
  currentUserId,
  onQuestionScoreCreated,
}: UseAutoCreateQuestionScoreParams): UseAutoCreateQuestionScoreReturn {
  const { mutateAsync: ensureScore } = useMutation(
    ensureQuestionScoreMutation(examId)
  )

  // 作成中のリクエストを追跡（重複作成防止）
  const creatingRef = useRef<string | null>(null)

  // 現在の採点行は、この設問（採点領域）の子として手元にある
  const currentCropRegionId = currentCropRegion?.id
  const currentQuestionScoreId =
    currentCropRegion && currentExamStudentId
      ? (findQuestionScore(
          currentCropRegion,
          currentExamStudentId,
          currentUserId ?? null
        )?.id ?? null)
      : null

  // QuestionScore作成関数
  const ensureQuestionScoreRow = useCallback(async () => {
    if (!currentExamStudentId || !currentCropRegionId || !currentUserId) {
      return
    }

    const key = `${currentExamStudentId}-${currentCropRegionId}-${currentUserId}`

    // 既に作成中の場合はスキップ
    if (creatingRef.current === key) {
      return
    }

    creatingRef.current = key

    try {
      await ensureScore({
        examStudentId: currentExamStudentId,
        cropRegionId: currentCropRegionId,
        userId: currentUserId,
      })

      // 作成成功 - 親コンポーネントに通知してリストを更新
      onQuestionScoreCreated?.()
    } catch {
      // 失敗の通知は MutationCache の後始末が出す
    } finally {
      // 作成完了後にリセット（別の設問に移動可能にする）
      if (creatingRef.current === key) {
        creatingRef.current = null
      }
    }
  }, [
    ensureScore,
    currentExamStudentId,
    currentCropRegionId,
    currentUserId,
    onQuestionScoreCreated,
  ])

  // 設問表示時にQuestionScoreが存在しない場合は自動作成
  useEffect(() => {
    if (
      currentExamStudentId &&
      currentCropRegionId &&
      currentUserId &&
      currentQuestionScoreId === null
    ) {
      ensureQuestionScoreRow()
    }
  }, [
    currentExamStudentId,
    currentCropRegionId,
    currentUserId,
    currentQuestionScoreId,
    ensureQuestionScoreRow,
  ])

  return {
    currentQuestionScoreId,
  }
}
