import { useCallback, useMemo, useRef, useState } from "react"

import type { ExtendedDisabledState } from "@/components/exams/06-student-answers/student-answer-table/types"
import { manualDisabledReason } from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import type { ExamPageColumn } from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

/**
 * 答案テーブルの行・列・セル単位の無効化状態と上書きモードを管理するフック。
 * 同一性でキーする: 行 = examStudentId[]、列 = examPageId[]、
 * セル = {studentId, examPageId}[]（いずれも少数なので配列）、
 * files = Set<fileId>（アップロードで多数になりうるので O(1)）。
 * 一括操作は名簿・ページ一覧を要するので、行・列の実体をフックが受け取る。
 */
export function useDisabledState({
  students,
  examPages,
}: {
  students: ExamStudentWithMemberships[]
  examPages: ExamPageColumn[]
}) {
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

  const toggleColDisabled = useCallback((examPageId: string) => {
    setDisabledState((prev) => ({
      ...prev,
      cols: prev.cols.includes(examPageId)
        ? prev.cols.filter((colExamPageId) => colExamPageId !== examPageId)
        : [...prev.cols, examPageId],
    }))
  }, [])

  // 欠席生徒の行は初期状態で無効。解除の基準線になるのでここで一度だけ導出する。
  const absentExamStudentIds = useMemo(
    () =>
      students
        .filter((examStudent) => examStudent.status === "absent")
        .map((examStudent) => examStudent.id),
    [students]
  )

  // 差し替え用の再スキャンでは「この行（生徒）だけに配置したい」が普通なので、
  // 対象を1つ残して他を無効にする一括操作を用意する。自動配置は有効マスを順に埋めるため、
  // これで狙った生徒・ページから確実に埋まる（残す対象が無効だった場合は有効へ戻す）。
  const disableRowsExcept = useCallback(
    (keptExamStudentId: string) => {
      setDisabledState((prev) => ({
        ...prev,
        rows: students
          .map((examStudent) => examStudent.id)
          .filter((examStudentId) => examStudentId !== keptExamStudentId),
      }))
    },
    [students]
  )

  const disableColsExcept = useCallback(
    (keptExamPageId: string) => {
      setDisabledState((prev) => ({
        ...prev,
        cols: examPages
          .map((examPage) => examPage.id)
          .filter((examPageId) => examPageId !== keptExamPageId),
      }))
    },
    [examPages]
  )

  // 一括解除は「手動で無効にした行」だけを戻す。欠席生徒の行まで有効にすると、
  // 自動配置が欠席者のマスを埋めて答案が付いてしまう（初期無効化は一度きりで再適用されない）。
  // 欠席行を有効にしたい場合は従来どおり、その行を名指しで有効化する。
  const enableAllRows = useCallback(() => {
    setDisabledState((prev) => ({ ...prev, rows: absentExamStudentIds }))
  }, [absentExamStudentIds])

  const enableAllCols = useCallback(() => {
    setDisabledState((prev) => ({ ...prev, cols: [] }))
  }, [])

  const toggleCellDisabled = useCallback(
    (studentId: string, examPageId: string) => {
      setDisabledState((prev) => {
        const alreadyDisabled = prev.cells.some(
          (cell) =>
            cell.studentId === studentId && cell.examPageId === examPageId
        )
        return {
          ...prev,
          cells: alreadyDisabled
            ? prev.cells.filter(
                (cell) =>
                  !(
                    cell.studentId === studentId &&
                    cell.examPageId === examPageId
                  )
              )
            : [...prev.cells, { studentId, examPageId }],
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
    (examStudent: ExamStudentWithMemberships, examPageId: string) => {
      return (
        manualDisabledReason(disabledState, examStudent, examPageId) !==
        undefined
      )
    },
    [disabledState]
  )

  // 欠席生徒を初期状態で行無効にする。初回ロード時のみ適用し、以降は
  // students の参照変化で再適用しない（教員が手動で有効化した行を握り潰さないため）。
  const didInitAbsentRef = useRef(false)
  const initializeStudentsWithoutAnswers = useCallback(() => {
    if (didInitAbsentRef.current || students.length === 0) return
    didInitAbsentRef.current = true

    if (absentExamStudentIds.length > 0) {
      setDisabledState((prev) => {
        const merged = [...prev.rows]
        for (const examStudentId of absentExamStudentIds) {
          if (!merged.includes(examStudentId)) merged.push(examStudentId)
        }
        return { ...prev, rows: merged }
      })
    }
  }, [students, absentExamStudentIds])

  return {
    disabledState,
    toggleRowDisabled,
    toggleColDisabled,
    disableRowsExcept,
    disableColsExcept,
    enableAllRows,
    enableAllCols,
    toggleCellDisabled,
    toggleFileDisabled,
    isCellDisabled,
    initializeStudentsWithoutAnswers,
    allowOverwrite,
    setAllowOverwrite,
  }
}
