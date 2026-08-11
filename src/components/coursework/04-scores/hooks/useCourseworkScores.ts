import { useCallback, useEffect, useRef, useState } from "react"

import type {
  CourseworkItemWithLetterScales,
  CourseworkScoreWithCourseworkStudent,
  CourseworkStudentWithMemberships,
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

/**
 * 名簿1行（対象者の生徒情報 + 評価項目ごとのセル値）
 *
 * 行の同定は資料の対象者（CourseworkStudent）の id で行う。点数の書き込み先が
 * 対象者だからで、人（Student）の id では名簿に載っていない生徒にも書けてしまう。
 */
interface CourseworkStudentRow {
  courseworkStudentId: string
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
 * 評価項目の点数の中から、その対象者の1件を取り出す。
 *
 * 引数に対象者の実体を要求することで、呼び出し側が生徒 id（Student.id）を
 * 渡してしまう取り違えを型で弾く（どちらも string で見分けがつかないため）。
 */
function findScoreOf(
  scores: CourseworkScoreWithCourseworkStudent[] | undefined,
  courseworkStudent: CourseworkStudentWithMemberships
): CourseworkScoreWithCourseworkStudent | undefined {
  return scores?.find(
    (score) => score.courseworkStudentId === courseworkStudent.id
  )
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
        courseworkStudentId: string
      } & CourseworkCellPatch
    >
  >(new Map())
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [coursework, courseworkStudents, courseworkClassrooms] =
        await Promise.all([
          window.electronAPI.coursework.getById(courseworkId),
          window.electronAPI.coursework.getStudents(courseworkId),
          window.electronAPI.coursework.getClassrooms(courseworkId),
        ])

      const sortedItems = coursework.items
        .slice()
        .sort((itemA, itemB) => itemA.order - itemB.order)
      setItems(sortedItems)

      const registeredClassroomIds = new Set(
        courseworkClassrooms.map(
          (courseworkClassroom) => courseworkClassroom.classroomId
        )
      )

      // 各評価項目の点数を並列取得（項目間は独立なので逐次にしない）
      const allScores: Record<string, CourseworkScoreWithCourseworkStudent[]> =
        {}
      const scoresPerItem = await Promise.all(
        sortedItems.map((item) =>
          window.electronAPI.coursework.getScores(item.id)
        )
      )
      sortedItems.forEach((item, itemIndex) => {
        allScores[item.id] = scoresPerItem[itemIndex]
      })

      // 生徒×評価項目のマトリックスを構築
      const rows: CourseworkStudentRow[] = courseworkStudents.map(
        (courseworkStudent) => {
          const cells: Record<string, CourseworkCell> = {}
          for (const item of sortedItems) {
            const score = findScoreOf(allScores[item.id], courseworkStudent)
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
            courseworkStudentId: courseworkStudent.id,
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
        courseworkStudentId: string
        patch: CourseworkCellPatch
      }[]
    ) => {
      if (changes.length === 0) return

      // ローカル状態を一括更新
      setStudentRows((prev) => {
        const changeMap = new Map<string, Map<string, CourseworkCellPatch>>()
        for (const change of changes) {
          if (!changeMap.has(change.courseworkStudentId))
            changeMap.set(change.courseworkStudentId, new Map())
          const studentMap = changeMap.get(change.courseworkStudentId)!
          studentMap.set(change.courseworkItemId, {
            ...studentMap.get(change.courseworkItemId),
            ...change.patch,
          })
        }
        return prev.map((row) => {
          const rowChanges = changeMap.get(row.courseworkStudentId)
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
        const key = `${change.courseworkItemId}:${change.courseworkStudentId}`
        pendingChanges.current.set(key, {
          ...pendingChanges.current.get(key),
          courseworkItemId: change.courseworkItemId,
          courseworkStudentId: change.courseworkStudentId,
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
