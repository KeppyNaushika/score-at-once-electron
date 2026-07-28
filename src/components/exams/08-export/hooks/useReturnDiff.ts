"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import type {
  ReturnDiffResult,
  ReturnStudentDiff,
} from "@/electron-src/lib/prisma/returnSnapshot"

/**
 * 答案返却スナップショットの記録と差分検出を管理するフック。
 *
 * - capture: 選択中の生徒を「返却版」として記録する
 * - diffByExamStudent: 生徒ID → 差分（返却版との比較結果）
 * - changedExamStudentIds: 返却版から変更があった生徒IDの集合
 */
export function useReturnDiff(examId: string) {
  const [diffByExamStudent, setDiffByStudent] = useState<
    Map<string, ReturnStudentDiff>
  >(new Map())
  const [hasAnySnapshot, setHasAnySnapshot] = useState(false)
  const [loading, setLoading] = useState(false)
  const [capturing, setCapturing] = useState(false)

  const refresh = useCallback(async () => {
    if (!examId || !window.electronAPI?.export?.getReturnDiff) return
    setLoading(true)
    try {
      const result: ReturnDiffResult =
        await window.electronAPI.export.getReturnDiff(examId)
      if (result.success) {
        setDiffByStudent(
          new Map(result.diffs.map((diff) => [diff.examStudentId, diff]))
        )
        setHasAnySnapshot(result.hasAnySnapshot)
      } else {
        console.error("返却差分の取得に失敗しました:", result.error)
      }
    } catch (error) {
      console.error("返却差分の取得に失敗しました:", error)
    } finally {
      setLoading(false)
    }
  }, [examId])

  useEffect(() => {
    refresh()
  }, [refresh])

  /** 指定生徒を返却版として記録する */
  const capture = useCallback(
    async (examStudentIds: string[]): Promise<boolean> => {
      if (!examId || examStudentIds.length === 0) return false
      setCapturing(true)
      try {
        const result = await window.electronAPI.export.captureReturnSnapshot({
          examId,
          examStudentIds,
        })
        if (result.success) {
          toast.success(`${result.capturedCount}名を返却版として記録しました`)
          await refresh()
          return true
        }
        toast.error(`返却版の記録に失敗しました: ${result.error ?? ""}`)
        return false
      } catch (error) {
        console.error("返却版の記録に失敗しました:", error)
        toast.error("返却版の記録に失敗しました")
        return false
      } finally {
        setCapturing(false)
      }
    },
    [examId, refresh]
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
    hasAnySnapshot,
    loading,
    capturing,
    capture,
    refresh,
  }
}
