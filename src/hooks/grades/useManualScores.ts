import { useCallback, useEffect, useRef, useState } from "react"

import type {
  GradeDataSourceWithDetails,
  ManualScoreWithStudent,
} from "@/types/grade.types"

interface StudentScore {
  studentId: string
  studentNumber: string
  lastName: string
  firstName: string
  attendanceNumber: number | null
  className: string | null
  scores: Record<string, number | null> // dataSourceId -> score
}

/**
 * 外部成績（手動スコア）の取得・更新を管理するフック
 *
 * 生徒ごとのスコアデータをロードし、個別更新・一括更新をデバウンス付きで提供する。
 *
 * @param gradeId - 対象の成績試験ID
 * @returns manualDataSources, studentScores, loading, updateScore, bulkUpdateScores
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
      { gradeDataSourceId: string; studentId: string; score: number | null }
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
          const scores: Record<string, number | null> = {}
          for (const dataSource of manualSources) {
            const manualScore = allScores[dataSource.id]?.find(
              (score) => score.studentId === examStudent.student.id
            )
            scores[dataSource.id] = manualScore?.score ?? null
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
            scores,
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

  const updateScore = useCallback(
    (dataSourceId: string, studentId: string, score: number | null) => {
      // ローカル状態を即座に更新
      setStudentScores((prev) =>
        prev.map((student) =>
          student.studentId === studentId
            ? {
                ...student,
                scores: { ...student.scores, [dataSourceId]: score },
              }
            : student
        )
      )

      // 変更をバッファに追加
      const key = `${dataSourceId}:${studentId}`
      pendingChanges.current.set(key, {
        gradeDataSourceId: dataSourceId,
        studentId,
        score,
      })

      // デバウンスして保存
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(async () => {
        const changes = Array.from(pendingChanges.current.values())
        pendingChanges.current.clear()
        if (changes.length > 0) {
          await window.electronAPI.grade.batchUpsertManualScores(changes)
        }
      }, 500)
    },
    []
  )

  const bulkUpdateScores = useCallback(
    (
      changes: {
        dataSourceId: string
        studentId: string
        score: number | null
      }[]
    ) => {
      if (changes.length === 0) return

      // ローカル状態を一括更新
      setStudentScores((prev) => {
        const changeMap = new Map<string, Map<string, number | null>>()
        for (const change of changes) {
          if (!changeMap.has(change.studentId))
            changeMap.set(change.studentId, new Map())
          changeMap
            .get(change.studentId)!
            .set(change.dataSourceId, change.score)
        }
        return prev.map((student) => {
          const studentChanges = changeMap.get(student.studentId)
          if (!studentChanges) return student
          const newScores = { ...student.scores }
          for (const [dataSourceId, score] of studentChanges) {
            newScores[dataSourceId] = score
          }
          return { ...student, scores: newScores }
        })
      })

      // pendingChangesに追加
      for (const change of changes) {
        const key = `${change.dataSourceId}:${change.studentId}`
        pendingChanges.current.set(key, {
          gradeDataSourceId: change.dataSourceId,
          studentId: change.studentId,
          score: change.score,
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
    updateScore,
    bulkUpdateScores,
  }
}
