import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { queryKeys } from "@/lib/queryKeys"

/**
 * 評価項目ごとの成績境界の取得・保存を管理するフック。
 *
 * 境界は評価項目の子として成績本体と一緒に降ってくるので、専用の取得APIは無い。
 */
export function useBoundaries(gradeId: string) {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.grade.detail(gradeId)
  const { data: grade = null, isPending: loading } = useQuery({
    queryKey,
    queryFn: () => window.electronAPI.grade.getById(gradeId),
  })

  const loadData = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  )

  const saveBoundaries = useCallback(
    async (data: {
      gradeItemId: string
      boundaries: { label: string; minPercentage: number; order: number }[]
    }) => {
      await window.electronAPI.grade.replaceGradeItemBoundaries(data)
      await loadData()
    },
    [loadData]
  )

  const deleteBoundaries = useCallback(
    async (gradeItemId: string) => {
      await window.electronAPI.grade.deleteGradeItemBoundaries(gradeItemId)
      await loadData()
    },
    [loadData]
  )

  return { grade, loading, saveBoundaries, deleteBoundaries }
}
