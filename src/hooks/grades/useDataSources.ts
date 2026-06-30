import { useCallback, useEffect, useState } from "react"

import type { GradeWithDetails } from "@/types/grade.types"

/** 成績評定項目とデータソースのCRUD操作を管理するフック */
export function useDataSources(gradeId: string) {
  const [exam, setExam] = useState<GradeWithDetails | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const gpResult = await window.electronAPI.grade.getById(gradeId)
      if (gpResult.success && gpResult.grade) {
        setExam(gpResult.grade)
      }
    } catch (error) {
      console.error("Error loading data sources:", error)
    } finally {
      setLoading(false)
    }
  }, [gradeId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const createGradeItem = useCallback(
    async (name: string) => {
      const result = await window.electronAPI.grade.createGradeItem({
        gradeId,
        name,
      })
      if (result.success) {
        await loadData()
      }
      return result
    },
    [gradeId, loadData]
  )

  const updateGradeItem = useCallback(
    async (id: string, name: string) => {
      const result = await window.electronAPI.grade.updateGradeItem(id, {
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
      const result = await window.electronAPI.grade.deleteGradeItem(id)
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
      examId?: string
      subtotalId?: string
      cropRegionId?: string
      courseworkItemId?: string
      name: string
      weight: number
    }) => {
      const result = await window.electronAPI.grade.createDataSource(data)
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
        weight?: number
        absentMethod?: string
        absentRatio?: number
        absentOffset?: number
        treatExpectedAsMissing?: boolean
        estimationMode?: string
        estimationSourceIds?: string[]
      }
    ) => {
      const result = await window.electronAPI.grade.updateDataSource(id, data)
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
      const result = await window.electronAPI.grade.batchUpdateAbsentPolicy(
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
      const result = await window.electronAPI.grade.deleteDataSource(id)
      if (result.success) {
        await loadData()
      }
      return result
    },
    [loadData]
  )

  return {
    exam,
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
