import { useCallback, useEffect, useState } from "react"

import type { GradeCalculationResult } from "@/types/gradeProject.types"

interface SetGradeOverrideParams {
  studentId: string
  targetType: "grade_item" | "overall"
  gradeItemId: string | null
  /** 上書きラベル。null の場合は上書きを削除（自動計算に戻す） */
  overrideLabel: string | null
}

export function useGradeResults(gradeProjectId: string) {
  const [result, setResult] = useState<GradeCalculationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const calculate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res =
        await window.electronAPI.gradeProject.calculateGrades(gradeProjectId)
      if (res.success && res.result) {
        setResult(res.result)
      } else {
        setError(res.error ?? "計算に失敗しました")
      }
    } catch (err) {
      console.error("Error calculating grades:", err)
      setError("計算中にエラーが発生しました")
    } finally {
      setLoading(false)
    }
  }, [gradeProjectId])

  useEffect(() => {
    calculate()
  }, [calculate])

  const setGradeOverride = useCallback(
    async (params: SetGradeOverrideParams) => {
      if (!result) return

      // 楽観的更新
      setResult((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          students: prev.students.map((student) => {
            if (student.studentId !== params.studentId) return student

            if (params.targetType === "overall") {
              const effectiveLabel =
                params.overrideLabel ?? student.originalOverallGradeLabel
              return {
                ...student,
                overallGradeLabel: effectiveLabel,
                overrideOverallGradeLabel: params.overrideLabel,
              }
            }

            return {
              ...student,
              gradeItemResults: student.gradeItemResults.map((item) => {
                if (item.gradeItemId !== params.gradeItemId) return item
                const effectiveLabel =
                  params.overrideLabel ?? item.originalGradeLabel
                return {
                  ...item,
                  gradeLabel: effectiveLabel,
                  overrideGradeLabel: params.overrideLabel,
                }
              }),
            }
          }),
        }
      })

      // DB 永続化
      try {
        if (params.overrideLabel) {
          await window.electronAPI.gradeProject.upsertGradeOverride({
            gradeProjectId,
            studentId: params.studentId,
            targetType: params.targetType,
            gradeItemId: params.gradeItemId,
            overrideLabel: params.overrideLabel,
          })
        } else {
          await window.electronAPI.gradeProject.deleteGradeOverride({
            gradeProjectId,
            studentId: params.studentId,
            targetType: params.targetType,
            gradeItemId: params.gradeItemId,
          })
        }
      } catch (err) {
        console.error("Error persisting grade override:", err)
        // エラー時は再計算して整合性を回復
        calculate()
      }
    },
    [gradeProjectId, result, calculate]
  )

  return { result, loading, error, recalculate: calculate, setGradeOverride }
}
