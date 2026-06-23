import { useCallback, useEffect, useRef, useState } from "react"

import type {
  GradeDataSourceWithDetails,
  ManualScoreWithStudent,
} from "@/types/grade.types"

/** 1セル分の手動成績（データソース×生徒） */
export interface ManualCell {
  /** 数値モードのスコア */
  score: number | null
  /** 文字モードの評価記号 */
  letterValue: string | null
  /** 加点・減点 */
  adjustment: number | null
  /** 加減点の理由 */
  adjustmentReason: string | null
  /** コメント（成績通知書に表示） */
  comment: string | null
}

/** 手動成績の部分更新（変更されたフィールドのみ） */
export type ManualCellPatch = Partial<ManualCell>

interface StudentScore {
  studentId: string
  studentNumber: string
  lastName: string
  firstName: string
  attendanceNumber: number | null
  className: string | null
  /** dataSourceId -> セル値 */
  cells: Record<string, ManualCell>
}

const EMPTY_CELL: ManualCell = {
  score: null,
  letterValue: null,
  adjustment: null,
  adjustmentReason: null,
  comment: null,
}

/**
 * 外部成績（手動スコア）の取得・更新を管理するフック
 *
 * 生徒ごとのスコア・文字評価・加減点・コメントをロードし、
 * 部分更新（セル単位）をデバウンス付きで提供する。
 *
 * @param gradeId - 対象の成績試験ID
 */
export function useManualScores(gradeId: string) {
  const [manualDataSources, setManualDataSources] = useState<
    GradeDataSourceWithDetails[]
  >([])
  const [studentScores, setStudentScores] = useState<StudentScore[]>([])
  const [loading, setLoading] = useState(true)
  const pendingChanges = useRef<
    Map<
      string,
      {
        gradeDataSourceId: string
        studentId: string
      } & ManualCellPatch
    >
  >(new Map())
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [examResult, studentsResult] = await Promise.all([
        window.electronAPI.grade.getById(gradeId),
        window.electronAPI.grade.getStudents(gradeId),
      ])
      if (!examResult.success || !examResult.grade) return

      const grade = examResult.grade
      const manualSources = grade.gradeItems
        .flatMap((gradeItem) => gradeItem.dataSources)
        .filter((dataSource) => dataSource.type === "manual")
      setManualDataSources(manualSources)

      if (!studentsResult.success || !studentsResult.students) return

      // 試験の登録学級IDリスト
      const classIds = grade.gradeClasses.map(
        (gradeClass) => gradeClass.classId
      )

      // 各データソースの手動スコアを取得
      const allScores: Record<string, ManualScoreWithStudent[]> = {}
      for (const dataSource of manualSources) {
        const result = await window.electronAPI.grade.getManualScores(
          dataSource.id
        )
        if (result.success && result.manualScores) {
          allScores[dataSource.id] = result.manualScores
        }
      }

      // 生徒×データソースのマトリックスを構築
      const students: StudentScore[] = studentsResult.students.map(
        (examStudent) => {
          const cells: Record<string, ManualCell> = {}
          for (const dataSource of manualSources) {
            const manualScore = allScores[dataSource.id]?.find(
              (score) => score.studentId === examStudent.student.id
            )
            cells[dataSource.id] = manualScore
              ? {
                  score: manualScore.score ?? null,
                  letterValue: manualScore.letterValue ?? null,
                  adjustment: manualScore.adjustment ?? null,
                  adjustmentReason: manualScore.adjustmentReason ?? null,
                  comment: manualScore.comment ?? null,
                }
              : { ...EMPTY_CELL }
          }
          // 登録学級内のmembershipを取得
          const membership = examStudent.student.memberships.find(
            (membership) => classIds.includes(membership.classId)
          )
          return {
            studentId: examStudent.student.id,
            studentNumber: examStudent.student.studentNumber,
            lastName: examStudent.student.lastName,
            firstName: examStudent.student.firstName,
            attendanceNumber: membership?.attendanceNumber ?? null,
            className: membership?.class.name ?? null,
            cells,
          }
        }
      )

      setStudentScores(students)
    } catch (error) {
      console.error("Error loading manual scores:", error)
    } finally {
      setLoading(false)
    }
  }, [gradeId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const bulkUpdateCells = useCallback(
    (
      changes: {
        dataSourceId: string
        studentId: string
        patch: ManualCellPatch
      }[]
    ) => {
      if (changes.length === 0) return

      // ローカル状態を一括更新
      setStudentScores((prev) => {
        const changeMap = new Map<string, Map<string, ManualCellPatch>>()
        for (const change of changes) {
          if (!changeMap.has(change.studentId))
            changeMap.set(change.studentId, new Map())
          const studentMap = changeMap.get(change.studentId)!
          studentMap.set(change.dataSourceId, {
            ...studentMap.get(change.dataSourceId),
            ...change.patch,
          })
        }
        return prev.map((student) => {
          const studentChanges = changeMap.get(student.studentId)
          if (!studentChanges) return student
          const newCells = { ...student.cells }
          for (const [dataSourceId, patch] of studentChanges) {
            newCells[dataSourceId] = {
              ...(newCells[dataSourceId] ?? EMPTY_CELL),
              ...patch,
            }
          }
          return { ...student, cells: newCells }
        })
      })

      // pendingChangesにマージ
      for (const change of changes) {
        const key = `${change.dataSourceId}:${change.studentId}`
        pendingChanges.current.set(key, {
          ...pendingChanges.current.get(key),
          gradeDataSourceId: change.dataSourceId,
          studentId: change.studentId,
          ...change.patch,
        })
      }

      // デバウンスして保存
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(async () => {
        const pending = Array.from(pendingChanges.current.values())
        pendingChanges.current.clear()
        if (pending.length > 0) {
          await window.electronAPI.grade.batchUpsertManualScores(pending)
        }
      }, 500)
    },
    []
  )

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return {
    manualDataSources,
    studentScores,
    loading,
    bulkUpdateCells,
  }
}
