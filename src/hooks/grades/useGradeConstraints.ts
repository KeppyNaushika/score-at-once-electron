import { useCallback, useEffect, useState } from "react"

import type {
  GradeConstraintData,
  GradeConstraintInput,
} from "@/types/grade.types"

/** 観点間の制約ルールの取得・作成・更新・削除・並べ替えを管理するフック */
export function useGradeConstraints(gradeId: string) {
  const [constraints, setConstraints] = useState<GradeConstraintData[]>([])

  const loadData = useCallback(async () => {
    try {
      const result = await window.electronAPI.grade.getGradeConstraints(gradeId)
      if (result.success && result.constraints) {
        setConstraints(result.constraints)
      }
    } catch (error) {
      console.error("Error loading grade constraints:", error)
    }
  }, [gradeId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const createConstraint = useCallback(
    async (constraint: GradeConstraintInput) => {
      const result = await window.electronAPI.grade.createGradeConstraint({
        gradeId,
        constraint,
      })
      if (result.success) await loadData()
      return result
    },
    [gradeId, loadData]
  )

  const updateConstraint = useCallback(
    async (id: string, constraint: Partial<GradeConstraintInput>) => {
      const result = await window.electronAPI.grade.updateGradeConstraint({
        id,
        constraint,
      })
      if (result.success) await loadData()
      return result
    },
    [loadData]
  )

  const deleteConstraint = useCallback(
    async (id: string) => {
      const result = await window.electronAPI.grade.deleteGradeConstraint(id)
      if (result.success) await loadData()
      return result
    },
    [loadData]
  )

  return {
    constraints,
    createConstraint,
    updateConstraint,
    deleteConstraint,
  }
}
