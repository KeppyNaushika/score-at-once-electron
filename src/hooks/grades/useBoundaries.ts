import { useCallback, useEffect, useState } from "react"

import type {
  GradeBoundarySetWithItemAndBoundaries,
  GradeWithRelations,
} from "@/types/grade.types"

/** 成績評定の境界値セットの取得・保存を管理するフック */
export function useBoundaries(gradeId: string) {
  const [exam, setExam] = useState<GradeWithRelations | null>(null)
  const [boundarySets, setBoundarySets] = useState<
    GradeBoundarySetWithItemAndBoundaries[]
  >([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [gpResult, bsResult] = await Promise.all([
        window.electronAPI.grade.getById(gradeId),
        window.electronAPI.grade.getBoundarySets(gradeId),
      ])

      if (gpResult.success && gpResult.grade) {
        setExam(gpResult.grade)
      }
      if (bsResult.success && bsResult.boundarySets) {
        setBoundarySets(bsResult.boundarySets)
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

  const saveBoundarySet = useCallback(
    async (data: {
      gradeItemId: string
      boundaries: { label: string; minPercentage: number; order: number }[]
    }) => {
      const result = await window.electronAPI.grade.upsertBoundarySet({
        gradeId,
        ...data,
      })
      if (result.success) {
        await loadData()
      }
      return result
    },
    [gradeId, loadData]
  )

  const deleteBoundarySet = useCallback(
    async (boundarySetId: string) => {
      const result =
        await window.electronAPI.grade.deleteBoundarySet(boundarySetId)
      if (result.success) {
        await loadData()
      }
      return result
    },
    [loadData]
  )

  return { exam, boundarySets, loading, saveBoundarySet, deleteBoundarySet }
}
