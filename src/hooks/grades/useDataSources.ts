import { useCallback, useEffect, useState } from "react"

import type {
  AbsentMethod,
  EstimationMode,
  GradeWithRelations,
} from "@/types/grade.types"

/** 成績評定項目とデータソースのCRUD操作を管理するフック */
export function useDataSources(gradeId: string) {
  const [exam, setExam] = useState<GradeWithRelations | null>(null)
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
      courseworkId?: string
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

  // 一括更新は専用IPCを持たず、普遍的な個別更新IPCをターゲット分だけ回す。
  // 自ソース除外などターゲットごとの差分は呼び出し側で組み立て済みの前提。
  //
  // 【設計判断】$transaction による原子性(all-or-nothing)は意図的に持たない。
  // 「一括適用」は同じ操作を各対象へ繰り返すだけの作業であり、部分適用が残っても
  // 意味が通り、再度「適用」を押せば回復できる（呼び出し側は失敗時に選択を保持し
  // 再適用可能にしている）。原子性のためだけに専用の一括IPC/トランザクションを
  // backendへ復活させないこと（普遍的な個別更新IPCのみを保つのが本設計の狙い）。
  const batchUpdateDataSources = useCallback(
    async (
      updates: {
        id: string
        data: {
          absentMethod?: AbsentMethod
          absentRatio?: number
          absentOffset?: number
          treatExpectedAsMissing?: boolean
          estimationMode?: EstimationMode
          estimationSourceIds?: string[]
        }
      }[]
    ) => {
      const results = await Promise.all(
        updates.map((update) =>
          window.electronAPI.grade.updateDataSource(update.id, update.data)
        )
      )
      // 個別更新は独立にコミットされ、一部失敗でもDBは変わり得る。
      // UIを実DBへ追従させるため成否に関わらず必ず再読込する。
      await loadData()
      return { success: results.every((result) => result.success) }
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

  const reorderDataSources = useCallback(
    async (items: { id: string; order: number }[]) => {
      const result = await window.electronAPI.grade.reorderDataSources(items)
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
    batchUpdateDataSources,
    deleteDataSource,
    reorderDataSources,
    reload: loadData,
  }
}
