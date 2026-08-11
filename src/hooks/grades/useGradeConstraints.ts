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
      setConstraints(
        await window.electronAPI.grade.getGradeConstraints(gradeId)
      )
    } catch (error) {
      console.error("Error loading grade constraints:", error)
    }
  }, [gradeId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const createConstraint = useCallback(
    async (constraint: GradeConstraintInput) => {
      const created = await window.electronAPI.grade.createGradeConstraint({
        gradeId,
        constraint,
      })
      await loadData()
      return created
    },
    [gradeId, loadData]
  )

  const updateConstraint = useCallback(
    async (id: string, constraint: Partial<GradeConstraintInput>) => {
      const updated = await window.electronAPI.grade.updateGradeConstraint({
        id,
        constraint,
      })
      await loadData()
      return updated
    },
    [loadData]
  )

  const deleteConstraint = useCallback(
    async (id: string) => {
      await window.electronAPI.grade.deleteGradeConstraint(id)
      await loadData()
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
