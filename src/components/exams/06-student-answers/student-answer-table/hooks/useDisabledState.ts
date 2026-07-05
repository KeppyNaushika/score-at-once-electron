import { useCallback, useState } from "react"

import type { ExtendedDisabledState } from "@/components/exams/06-student-answers/student-answer-table/types"
import type { ExamStudentWithDetails } from "@/types/prismaExtensions"

/** 答案テーブルの行・列・セル単位の無効化状態と上書きモードを管理するフック */
export function useDisabledState() {
  const [disabledState, setDisabledState] = useState<ExtendedDisabledState>({
    rows: new Set(),
    cols: new Set(),
    positions: new Set(),
    files: new Set(),
  })

  // 既存答案上書きモードの状態管理
  const [allowOverwrite, setAllowOverwrite] = useState(false)

  const toggleRowDisabled = useCallback((rowIndex: number) => {
    setDisabledState((prev) => {
      const newRows = new Set(prev.rows)
      if (newRows.has(rowIndex)) {
        newRows.delete(rowIndex)
      } else {
        newRows.add(rowIndex)
      }
      return { ...prev, rows: newRows }
    })
  }, [])

  const toggleColDisabled = useCallback((colIndex: number) => {
    setDisabledState((prev) => {
      const newCols = new Set(prev.cols)
      if (newCols.has(colIndex)) {
        newCols.delete(colIndex)
      } else {
        newCols.add(colIndex)
      }
      return { ...prev, cols: newCols }
    })
  }, [])

  const togglePositionDisabled = useCallback((position: number) => {
    setDisabledState((prev) => {
      const newPositions = new Set(prev.positions)
      if (newPositions.has(position)) {
        newPositions.delete(position)
      } else {
        newPositions.add(position)
      }
      return { ...prev, positions: newPositions }
    })
  }, [])

  const toggleFileDisabled = useCallback((fileId: string) => {
    setDisabledState((prev) => {
      const newFiles = new Set(prev.files)
      if (newFiles.has(fileId)) {
        newFiles.delete(fileId)
      } else {
        newFiles.add(fileId)
      }
      return { ...prev, files: newFiles }
    })
  }, [])

  const isPositionDisabled = useCallback(
    (studentIndex: number, pageIndex: number) => {
      const position = studentIndex * 100 + pageIndex // Simple position calculation
      return (
        disabledState.rows.has(studentIndex) ||
        disabledState.cols.has(pageIndex) ||
        disabledState.positions.has(position)
      )
    },
    [disabledState]
  )

  // 初期化関数（現在は何もしない）
  const initializeStudentsWithoutAnswers = useCallback(
    (students: ExamStudentWithDetails[]) => {
      // 欠席生徒を初期状態で行無効にする（ユーザーが手動で有効化可能）
      const sortedStudents = [...students].sort((studentA, studentB) => {
        const studentAOrder = studentA.customOrder ?? Number.MAX_SAFE_INTEGER
        const studentBOrder = studentB.customOrder ?? Number.MAX_SAFE_INTEGER
        return studentAOrder - studentBOrder
      })

      const absentStudentRows = new Set<number>()
      sortedStudents.forEach((student, index) => {
        if (student.status === "absent") {
          absentStudentRows.add(index)
        }
      })

      // 欠席生徒がいる場合のみ状態を更新
      if (absentStudentRows.size > 0) {
        setDisabledState((prev) => ({
          ...prev,
          rows: new Set([...prev.rows, ...absentStudentRows]),
        }))
      }
    },
    []
  )

  return {
    disabledState,
    toggleRowDisabled,
    toggleColDisabled,
    togglePositionDisabled,
    toggleFileDisabled,
    isPositionDisabled,
    initializeStudentsWithoutAnswers,
    allowOverwrite,
    setAllowOverwrite,
  }
}
