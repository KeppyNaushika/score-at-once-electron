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
      const result = await window.electronAPI.grade.getById(gradeId)
      if (result.success && result.grade) {
        setGrade(result.grade)
      }
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
      const result =
        await window.electronAPI.grade.replaceGradeItemBoundaries(data)
      if (result.success) {
        await loadData()
      }
      return result
    },
    [loadData]
  )

  const deleteBoundaries = useCallback(
    async (gradeItemId: string) => {
      const result =
        await window.electronAPI.grade.deleteGradeItemBoundaries(gradeItemId)
      if (result.success) {
        await loadData()
      }
      return result
    },
    [loadData]
  )

  return { grade, loading, saveBoundaries, deleteBoundaries }
}
