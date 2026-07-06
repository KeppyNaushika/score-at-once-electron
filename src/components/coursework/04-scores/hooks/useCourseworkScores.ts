import { useCallback, useEffect, useRef, useState } from "react"

import type {
  CourseworkItemWithLetterScales,
  CourseworkScoreWithStudent,
} from "@/types/coursework.types"

/** 1セル分の点数（評価項目×生徒） */
export interface CourseworkCell {
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

/** 点数の部分更新（変更されたフィールドのみ） */
export type CourseworkCellPatch = Partial<CourseworkCell>

/** 名簿1行（生徒情報 + 評価項目ごとのセル値） */
export interface CourseworkStudentRow {
  studentId: string
  studentNumber: string
  lastName: string
  firstName: string
  attendanceNumber: number | null
  className: string | null
  /** courseworkItemId -> セル値 */
  cells: Record<string, CourseworkCell>
}

const EMPTY_CELL: CourseworkCell = {
  score: null,
  letterValue: null,
  adjustment: null,
  adjustmentReason: null,
  comment: null,
}

/**
 * 試験外成績資料の点数の取得・更新を管理するフック
 *
 * 名簿（生徒）を行、評価項目を列として、各セルのスコア・文字評価・加減点・コメントを
 * ロードし、部分更新（セル単位）をデバウンス付きで提供する。
 *
 * @param courseworkId - 対象の資料ID
 */
export function useCourseworkScores(courseworkId: string) {
  const [items, setItems] = useState<CourseworkItemWithLetterScales[]>([])
  const [studentRows, setStudentRows] = useState<CourseworkStudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const pendingChanges = useRef<
    Map<
      string,
      {
        courseworkItemId: string
        studentId: string
      } & CourseworkCellPatch
    >
  >(new Map())
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [courseworkResult, studentsResult, classroomsResult] =
        await Promise.all([
          window.electronAPI.coursework.getById(courseworkId),
          window.electronAPI.coursework.getStudents(courseworkId),
          window.electronAPI.coursework.getClassrooms(courseworkId),
        ])
      if (!courseworkResult.success || !courseworkResult.coursework) return

      const sortedItems = courseworkResult.coursework.items
        .slice()
        .sort((itemA, itemB) => itemA.order - itemB.order)
      setItems(sortedItems)

      if (!studentsResult.success || !studentsResult.students) return

      const registeredClassroomIds = new Set(
        classroomsResult.success && classroomsResult.classrooms
          ? classroomsResult.classrooms.map(
              (courseworkClassroom) => courseworkClassroom.classroomId
            )
          : []
      )

      // 各評価項目の点数を並列取得（項目間は独立なので逐次にしない）
      const allScores: Record<string, CourseworkScoreWithStudent[]> = {}
      const scoreResults = await Promise.all(
        sortedItems.map((item) =>
          window.electronAPI.coursework.getScores(item.id)
        )
      )
      sortedItems.forEach((item, i) => {
        const result = scoreResults[i]
        if (result.success && result.scores) {
          allScores[item.id] = result.scores
        }
      })

      // 生徒×評価項目のマトリックスを構築
      const rows: CourseworkStudentRow[] = studentsResult.students.map(
        (courseworkStudent) => {
          const cells: Record<string, CourseworkCell> = {}
          for (const item of sortedItems) {
            const score = allScores[item.id]?.find(
              (score) => score.studentId === courseworkStudent.student.id
            )
            cells[item.id] = score
              ? {
                  score: score.score ?? null,
                  letterValue: score.letterValue ?? null,
                  adjustment: score.adjustment ?? null,
                  adjustmentReason: score.adjustmentReason ?? null,
                  comment: score.comment ?? null,
                }
              : { ...EMPTY_CELL }
          }
          const membership = courseworkStudent.student.memberships.find(
            (membership) => registeredClassroomIds.has(membership.classroomId)
          )
          return {
            studentId: courseworkStudent.student.id,
            studentNumber: courseworkStudent.student.studentNumber,
            lastName: courseworkStudent.student.lastName,
            firstName: courseworkStudent.student.firstName,
            attendanceNumber: membership?.attendanceNumber ?? null,
            className: membership?.classroom.name ?? null,
            cells,
          }
        }
      )

      setStudentRows(rows)
    } catch (error) {
      console.error("Error loading coursework scores:", error)
    } finally {
      setLoading(false)
    }
  }, [courseworkId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 未保存の変更を即座にDBへ反映する（デバウンス完了時・アンマウント時に使用）
  const flushPending = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    const pending = Array.from(pendingChanges.current.values())
    pendingChanges.current.clear()
    if (pending.length > 0) {
      await window.electronAPI.coursework.batchUpsertScores(pending)
    }
  }, [])

  const bulkUpdateCells = useCallback(
    (
      changes: {
        courseworkItemId: string
        studentId: string
        patch: CourseworkCellPatch
      }[]
    ) => {
      if (changes.length === 0) return

      // ローカル状態を一括更新
      setStudentRows((prev) => {
        const changeMap = new Map<string, Map<string, CourseworkCellPatch>>()
        for (const change of changes) {
          if (!changeMap.has(change.studentId))
            changeMap.set(change.studentId, new Map())
          const studentMap = changeMap.get(change.studentId)!
          studentMap.set(change.courseworkItemId, {
            ...studentMap.get(change.courseworkItemId),
            ...change.patch,
          })
        }
        return prev.map((row) => {
          const rowChanges = changeMap.get(row.studentId)
          if (!rowChanges) return row
          const newCells = { ...row.cells }
          for (const [itemId, patch] of rowChanges) {
            newCells[itemId] = {
              ...(newCells[itemId] ?? EMPTY_CELL),
              ...patch,
            }
          }
          return { ...row, cells: newCells }
        })
      })

      // pendingChangesにマージ
      for (const change of changes) {
        const key = `${change.courseworkItemId}:${change.studentId}`
        pendingChanges.current.set(key, {
          ...pendingChanges.current.get(key),
          courseworkItemId: change.courseworkItemId,
          studentId: change.studentId,
          ...change.patch,
        })
      }

      // デバウンスして保存
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        void flushPending()
      }, 500)
    },
    [flushPending]
  )

  // アンマウント時、未保存の変更が残っていれば即座にフラッシュする
  useEffect(() => {
    return () => {
      void flushPending()
    }
  }, [flushPending])

  return {
    items,
    studentRows,
    loading,
    bulkUpdateCells,
  }
}
