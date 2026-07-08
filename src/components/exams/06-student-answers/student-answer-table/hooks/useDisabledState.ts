import { useCallback, useRef, useState } from "react"

import type { ExtendedDisabledState } from "@/components/exams/06-student-answers/student-answer-table/types"
import { manualDisabledReason } from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

/**
 * 答案テーブルの行・列・セル単位の無効化状態と上書きモードを管理するフック。
 * 同一性でキーする: 行 = examStudentId[]、列 = pageNumber[]、
 * セル = {studentId, pageNumber}[]（いずれも少数なので配列）、
 * files = Set<fileId>（アップロードで多数になりうるので O(1)）。
 */
export function useDisabledState() {
  const [disabledState, setDisabledState] = useState<ExtendedDisabledState>({
    rows: [],
    cols: [],
    cells: [],
    files: new Set(),
  })

  // 既存答案上書きモードの状態管理
  const [allowOverwrite, setAllowOverwrite] = useState(false)

  const toggleRowDisabled = useCallback((examStudentId: string) => {
    setDisabledState((prev) => ({
      ...prev,
      rows: prev.rows.includes(examStudentId)
        ? prev.rows.filter(
            (rowExamStudentId) => rowExamStudentId !== examStudentId
          )
        : [...prev.rows, examStudentId],
    }))
  }, [])

  const toggleColDisabled = useCallback((pageNumber: number) => {
    setDisabledState((prev) => ({
      ...prev,
      cols: prev.cols.includes(pageNumber)
        ? prev.cols.filter((colPageNumber) => colPageNumber !== pageNumber)
        : [...prev.cols, pageNumber],
    }))
  }, [])

  const toggleCellDisabled = useCallback(
    (studentId: string, pageNumber: number) => {
      setDisabledState((prev) => {
        const alreadyDisabled = prev.cells.some(
          (cell) =>
            cell.studentId === studentId && cell.pageNumber === pageNumber
        )
        return {
          ...prev,
          cells: alreadyDisabled
            ? prev.cells.filter(
                (cell) =>
                  !(
                    cell.studentId === studentId &&
                    cell.pageNumber === pageNumber
                  )
              )
            : [...prev.cells, { studentId, pageNumber }],
        }
      })
    },
    []
  )

  const toggleFileDisabled = useCallback((fileId: string) => {
    setDisabledState((prev) => {
      const nextFiles = new Set(prev.files)
      if (nextFiles.has(fileId)) {
        nextFiles.delete(fileId)
      } else {
        nextFiles.add(fileId)
      }
      return { ...prev, files: nextFiles }
    })
  }, [])

  const isCellDisabled = useCallback(
    (examStudent: ExamStudentWithMemberships, pageNumber: number) => {
      return (
        manualDisabledReason(disabledState, examStudent, pageNumber) !==
        undefined
      )
    },
    [disabledState]
  )

  // 欠席生徒を初期状態で行無効にする。初回ロード時のみ適用し、以降は
  // students の参照変化で再適用しない（教員が手動で有効化した行を握り潰さないため）。
  const didInitAbsentRef = useRef(false)
  const initializeStudentsWithoutAnswers = useCallback(
    (students: ExamStudentWithMemberships[]) => {
      if (didInitAbsentRef.current || students.length === 0) return
      didInitAbsentRef.current = true

      const absentExamStudentIds = students
        .filter((examStudent) => examStudent.status === "absent")
        .map((examStudent) => examStudent.id)

      if (absentExamStudentIds.length > 0) {
        setDisabledState((prev) => {
          const merged = [...prev.rows]
          for (const examStudentId of absentExamStudentIds) {
            if (!merged.includes(examStudentId)) merged.push(examStudentId)
          }
          return { ...prev, rows: merged }
        })
      }
    },
    []
  )

  return {
    disabledState,
    toggleRowDisabled,
    toggleColDisabled,
    toggleCellDisabled,
    toggleFileDisabled,
    isCellDisabled,
    initializeStudentsWithoutAnswers,
    allowOverwrite,
    setAllowOverwrite,
  }
}
