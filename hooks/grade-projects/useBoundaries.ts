import { useCallback, useEffect, useState } from "react"

import type {
  GradeBoundarySetWithDetails,
  GradeProjectWithDetails,
} from "@/types/gradeProject.types"

export function useBoundaries(gradeProjectId: string) {
  const [project, setProject] = useState<GradeProjectWithDetails | null>(null)
  const [boundarySets, setBoundarySets] = useState<
    GradeBoundarySetWithDetails[]
  >([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [gpResult, bsResult] = await Promise.all([
        window.electronAPI.gradeProject.getById(gradeProjectId),
        window.electronAPI.gradeProject.getBoundarySets(gradeProjectId),
      ])

      if (gpResult.success && gpResult.gradeProject) {
        setProject(gpResult.gradeProject)
      }
      if (bsResult.success && bsResult.boundarySets) {
        setBoundarySets(bsResult.boundarySets)
      }
    } catch (error) {
      console.error("Error loading boundaries:", error)
    } finally {
      setLoading(false)
    }
  }, [gradeProjectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const saveBoundarySet = useCallback(
    async (data: {
      targetType: string
      gradeItemId: string | null
      boundaries: { label: string; minPercentage: number; order: number }[]
    }) => {
      const result = await window.electronAPI.gradeProject.upsertBoundarySet({
        gradeProjectId,
        ...data,
      })
      if (result.success) {
        await loadData()
      }
      return result
    },
    [gradeProjectId, loadData]
  )

  return { project, boundarySets, loading, saveBoundarySet, reload: loadData }
}
