import { useCallback, useEffect, useState } from "react"

import type { GradeProjectWithDetails } from "@/types/gradeProject.types"

export function useDataSources(gradeProjectId: string) {
  const [project, setProject] = useState<GradeProjectWithDetails | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const gpResult =
        await window.electronAPI.gradeProject.getById(gradeProjectId)
      if (gpResult.success && gpResult.gradeProject) {
        setProject(gpResult.gradeProject)
      }
    } catch (error) {
      console.error("Error loading data sources:", error)
    } finally {
      setLoading(false)
    }
  }, [gradeProjectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const createGradeItem = useCallback(
    async (name: string) => {
      const result = await window.electronAPI.gradeProject.createGradeItem({
        gradeProjectId,
        name,
      })
      if (result.success) {
        await loadData()
      }
      return result
    },
    [gradeProjectId, loadData]
  )

  const updateGradeItem = useCallback(
    async (id: string, name: string) => {
      const result = await window.electronAPI.gradeProject.updateGradeItem(id, {
        name,
      })
      if (result.success) {
        await loadData()
      }
      return result
    },
    [loadData]
  )

  const deleteGradeItem = useCallback(
    async (id: string) => {
      const result = await window.electronAPI.gradeProject.deleteGradeItem(id)
      if (result.success) {
        await loadData()
      }
      return result
    },
    [loadData]
  )

  const createDataSource = useCallback(
    async (data: {
      gradeItemId: string
      type: string
      examProjectId?: string
      subtotalId?: string
      cropRegionId?: string
      name: string
      maxScore: number
      weight: number
    }) => {
      const result =
        await window.electronAPI.gradeProject.createDataSource(data)
      if (result.success) {
        await loadData()
      }
      return result
    },
    [loadData]
  )

  const updateDataSource = useCallback(
    async (
      id: string,
      data: {
        name?: string
        maxScore?: number
        weight?: number
        absentMethod?: string
        absentRatio?: number
        absentOffset?: number
        treatExpectedAsMissing?: boolean
        estimationMode?: string
        estimationSourceIds?: string[]
      }
    ) => {
      const result = await window.electronAPI.gradeProject.updateDataSource(
        id,
        data
      )
      if (result.success) {
        await loadData()
      }
      return result
    },
    [loadData]
  )

  const batchUpdateAbsentPolicy = useCallback(
    async (
      dataSourceIds: string[],
      policy: {
        absentMethod: string
        absentRatio: number
        absentOffset: number
      }
    ) => {
      const result =
        await window.electronAPI.gradeProject.batchUpdateAbsentPolicy(
          dataSourceIds,
          policy
        )
      if (result.success) {
        await loadData()
      }
      return result
    },
    [loadData]
  )

  const deleteDataSource = useCallback(
    async (id: string) => {
      const result = await window.electronAPI.gradeProject.deleteDataSource(id)
      if (result.success) {
        await loadData()
      }
      return result
    },
    [loadData]
  )

  return {
    project,
    loading,
    createGradeItem,
    updateGradeItem,
    deleteGradeItem,
    createDataSource,
    updateDataSource,
    batchUpdateAbsentPolicy,
    deleteDataSource,
    reload: loadData,
  }
}
