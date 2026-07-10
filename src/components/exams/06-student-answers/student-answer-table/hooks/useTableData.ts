import { useCallback, useMemo } from "react"

import { useTableDataGeneration } from "@/components/exams/06-student-answers/student-answer-table/hooks/useTableDataGeneration"
import type { ExtendedDisabledState } from "@/components/exams/06-student-answers/student-answer-table/types"
import {
  calculateCellsWithExistingAnswers,
  calculateDynamicDisabledCells,
  getDisabledFiles,
  getEnabledFiles,
  getFileColor,
  lookupHasCell,
  sortStudentsByCustomOrder,
} from "@/components/exams/06-student-answers/student-answer-table/utils/tableDataUtils"
import type {
  AnswerItem,
  PlacementStrategy,
  UnifiedFile,
} from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

interface UseTableDataParams {
  files: UnifiedFile[]
  students: ExamStudentWithMemberships[]
  modelAnswerCount: number
  fileOrder: PlacementStrategy
  disabledState: ExtendedDisabledState
  isCellDisabled: (
    examStudent: ExamStudentWithMemberships,
    pageNumber: number
  ) => boolean
  mode?: "upload" | "view"
  existingStudentAnswers?: Array<{
    id: string
    studentId: string | null
    pageNumber: number
  }>
  allowOverwrite?: boolean
}

/**
 * テーブルデータの管理を行うメインフック（リファクタリング版）
 */
export function useTableData({
  files,
  students,
  modelAnswerCount,
  fileOrder,
  disabledState,
  isCellDisabled,
  mode,
  existingStudentAnswers,
  allowOverwrite = false,
}: UseTableDataParams) {
  // 生徒のソート（customOrder準拠）
  const sortedStudents = useMemo(() => {
    return sortStudentsByCustomOrder(students)
  }, [students])

  // 動的無効化セルの計算
  const dynamicDisabledCells = useMemo(() => {
    return calculateDynamicDisabledCells(
      files,
      sortedStudents,
      modelAnswerCount,
      disabledState,
      mode
    )
  }, [files, sortedStudents, modelAnswerCount, disabledState, mode])

  // 手動無効化 + 動的無効化を合わせたセル無効判定
  const enhancedIsCellDisabled = useCallback(
    (examStudent: ExamStudentWithMemberships, pageNumber: number) => {
      // 元の無効化チェック
      if (isCellDisabled(examStudent, pageNumber)) return true

      // 動的無効化チェック
      return lookupHasCell(
        dynamicDisabledCells,
        examStudent.studentId,
        pageNumber
      )
    },
    [isCellDisabled, dynamicDisabledCells]
  )

  // 既存答案があるセルの計算（警告オーバーレイ用）
  const cellsWithExistingAnswers = useMemo(() => {
    return calculateCellsWithExistingAnswers(
      files,
      sortedStudents,
      modelAnswerCount,
      disabledState,
      mode,
      existingStudentAnswers
    )
  }, [
    files,
    sortedStudents,
    modelAnswerCount,
    disabledState,
    mode,
    existingStudentAnswers,
  ])

  // 有効/無効ファイルの取得
  const getEnabledFilesCallback = useCallback(() => {
    return getEnabledFiles(files, disabledState)
  }, [files, disabledState])

  const getDisabledFilesCallback = useCallback(() => {
    return getDisabledFiles(files, disabledState)
  }, [files, disabledState])

  // ファイルカラーの取得
  const getFileColorCallback = useCallback((file: AnswerItem) => {
    return getFileColor(file)
  }, [])

  // テーブルデータの生成
  const { tableData } = useTableDataGeneration({
    files,
    sortedStudents,
    modelAnswerCount,
    fileOrder,
    disabledState,
    mode,
    enhancedIsCellDisabled,
    allowOverwrite,
    existingStudentAnswers,
  })

  return {
    sortedStudents,
    getEnabledFiles: getEnabledFilesCallback,
    getDisabledFiles: getDisabledFilesCallback,
    getFileColor: getFileColorCallback,
    tableData,
    cellsWithExistingAnswers,
  }
}
