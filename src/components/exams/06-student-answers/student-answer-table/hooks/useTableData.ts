import { useCallback, useMemo } from "react"

import { useTableDataGeneration } from "@/components/exams/06-student-answers/student-answer-table/hooks/useTableDataGeneration"
import type { ExtendedDisabledState } from "@/components/exams/06-student-answers/student-answer-table/types"
import {
  calculateCellsWithExistingAnswers,
  calculateDynamicDisabledCells,
  getDisabledFiles,
  getEnabledFiles,
  lookupHasCell,
  sortStudentsByCustomOrder,
} from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import type {
  AnswerImageIdentity,
  ExamPageColumn,
  PlacementStrategy,
} from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

interface UseTableDataParams<TItem extends AnswerImageIdentity> {
  files: TItem[]
  students: ExamStudentWithMemberships[]
  examPages: ExamPageColumn[]
  fileOrder: PlacementStrategy
  disabledState: ExtendedDisabledState
  isCellDisabled: (
    examStudent: ExamStudentWithMemberships,
    examPageId: string
  ) => boolean
  mode?: "upload" | "view"
  existingAnswers?: AnswerImageIdentity[]
  allowOverwrite?: boolean
}

/**
 * テーブルデータの管理を行うメインフック（entity-first 版）。
 * 列は ExamPage 実体で回し、セルの同定・照合は examPageId で行う。
 */
export function useTableData<TItem extends AnswerImageIdentity>({
  files,
  students,
  examPages,
  fileOrder,
  disabledState,
  isCellDisabled,
  mode,
  existingAnswers,
  allowOverwrite = false,
}: UseTableDataParams<TItem>) {
  // 生徒のソート（customOrder準拠）
  const sortedStudents = useMemo(() => {
    return sortStudentsByCustomOrder(students)
  }, [students])

  // 動的無効化セルの計算
  const dynamicDisabledCells = useMemo(() => {
    return calculateDynamicDisabledCells(
      files,
      sortedStudents,
      examPages,
      disabledState,
      mode
    )
  }, [files, sortedStudents, examPages, disabledState, mode])

  // 手動無効化 + 動的無効化を合わせたセル無効判定
  const enhancedIsCellDisabled = useCallback(
    (examStudent: ExamStudentWithMemberships, examPageId: string) => {
      // 元の無効化チェック
      if (isCellDisabled(examStudent, examPageId)) return true

      // 動的無効化チェック
      return lookupHasCell(
        dynamicDisabledCells,
        examStudent.studentId,
        examPageId
      )
    },
    [isCellDisabled, dynamicDisabledCells]
  )

  // 既存答案があるセルの計算（警告オーバーレイ用）
  const cellsWithExistingAnswers = useMemo(() => {
    return calculateCellsWithExistingAnswers(
      files,
      sortedStudents,
      examPages,
      disabledState,
      mode,
      existingAnswers
    )
  }, [files, sortedStudents, examPages, disabledState, mode, existingAnswers])

  // 有効/無効ファイルの取得
  const getEnabledFilesCallback = useCallback(() => {
    return getEnabledFiles(files, disabledState)
  }, [files, disabledState])

  const getDisabledFilesCallback = useCallback(() => {
    return getDisabledFiles(files, disabledState)
  }, [files, disabledState])

  // テーブル行の生成（行に ExamStudent 実体、各マスに ExamPage 実体を同梱）
  const { tableRows, orphanItems, unplacedItems } = useTableDataGeneration({
    files,
    sortedStudents,
    examPages,
    fileOrder,
    disabledState,
    mode,
    enhancedIsCellDisabled,
    allowOverwrite,
    cellsWithExistingAnswers,
  })

  return {
    getEnabledFiles: getEnabledFilesCallback,
    getDisabledFiles: getDisabledFilesCallback,
    tableRows,
    orphanItems,
    unplacedItems,
    cellsWithExistingAnswers,
  }
}
