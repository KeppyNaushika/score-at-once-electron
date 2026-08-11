"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import { queryKeys } from "@/lib/queryKeys"

/**
 * 答案返却スナップショットの記録と差分検出を管理するフック。
 *
 * - capture: 選択中の生徒を「返却版」として記録する
 * - diffByExamStudent: 生徒ID → 差分（返却版との比較結果）
 * - changedExamStudentIds: 返却版から変更があった生徒IDの集合
 */
export function useReturnDiff(examId: string) {
  const queryClient = useQueryClient()
  const [capturing, setCapturing] = useState(false)

  const { data: returnDiff } = useQuery({
    queryKey: queryKeys.returnDiff.detail(examId),
    queryFn: () => window.electronAPI.export.getReturnDiff(examId),
  })

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
      setCapturing(true)
      try {
        const { capturedCount } =
          await window.electronAPI.export.captureReturnSnapshot({
            examId,
            examStudentIds,
          })
        toast.success(`${capturedCount}名を返却版として記録しました`)
        await queryClient.invalidateQueries({
          queryKey: queryKeys.returnDiff.detail(examId),
        })
        return true
      } catch (error) {
        console.error("返却版の記録に失敗しました:", error)
        toast.error("返却版の記録に失敗しました")
        return false
      } finally {
        setCapturing(false)
      }
    },
    [examId, queryClient]
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
    capturing,
    capture,
  }
}
