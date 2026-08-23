"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import { toast } from "sonner"

import {
  captureReturnSnapshotMutation,
  returnDiffQuery,
} from "@/queries/export"

/**
 * 答案返却スナップショットの記録と差分検出を管理するフック。
 *
 * - capture: 選択中の生徒を「返却版」として記録する
 * - diffByExamStudent: 生徒ID → 差分（返却版との比較結果）
 * - changedExamStudentIds: 返却版から変更があった生徒IDの集合
 */
export function useReturnDiff(examId: string) {
  const { data: returnDiff } = useQuery({
    ...returnDiffQuery(examId),
    enabled: Boolean(examId),
  })
  const captureSnapshot = useMutation(captureReturnSnapshotMutation(examId))
  const { mutateAsync: captureSnapshotAsync } = captureSnapshot

  const diffByExamStudent = useMemo(
    () =>
      new Map(
        (returnDiff?.diffs ?? []).map((diff) => [diff.examStudentId, diff])
      ),
    [returnDiff]
  )

  /** 指定生徒を返却版として記録する */
  const capture = useCallback(
    async (examStudentIds: string[]): Promise<boolean> => {
      if (!examId || examStudentIds.length === 0) return false
      try {
        const { capturedCount } = await captureSnapshotAsync({
          examId,
          examStudentIds,
        })
        toast.success(`${capturedCount}名を返却版として記録しました`)
        return true
      } catch {
        // 失敗の通知と取り直しは MutationCache の後始末が担う
        return false
      }
    },
    [captureSnapshotAsync, examId]
  )

  const changedExamStudentIds = useMemo(() => {
    const ids = new Set<string>()
    for (const diff of diffByExamStudent.values()) {
      if (diff.changed) ids.add(diff.examStudentId)
    }
    return ids
  }, [diffByExamStudent])

  return {
    diffByExamStudent,
    changedExamStudentIds,
    hasAnySnapshot: returnDiff?.hasAnySnapshot ?? false,
    capturing: captureSnapshot.isPending,
    capture,
  }
}
