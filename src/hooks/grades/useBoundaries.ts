import { useCallback, useEffect, useState } from "react"

import type { GradeWithRelations } from "@/types/grade.types"

/**
 * 評価項目ごとの成績境界の取得・保存を管理するフック。
 *
 * 境界は評価項目の子として成績本体と一緒に降ってくるので、専用の取得APIは無い。
 */
export function useBoundaries(gradeId: string) {
  const [grade, setGrade] = useState<GradeWithRelations | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      setGrade(await window.electronAPI.grade.getById(gradeId))
    } catch (error) {
      console.error("Error loading boundaries:", error)
    } finally {
      setLoading(false)
    }
  }, [gradeId])

  useEffect(() => {
    loadData()
  }, [loadData])

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
