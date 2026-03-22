import { useCallback, useEffect, useState } from "react"

import type {
  GradeBoundarySetWithDetails,
  GradeWithDetails,
} from "@/types/grade.types"

export function useBoundaries(gradeId: string) {
  const [exam, setExam] = useState<GradeWithDetails | null>(null)
  const [boundarySets, setBoundarySets] = useState<
    GradeBoundarySetWithDetails[]
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
      targetType: string
      gradeItemId: string | null
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

  return { exam, boundarySets, loading, saveBoundarySet }
}
