import { useCallback, useMemo } from "react"

import { useTableDataGeneration } from "@/components/projects/06-student-answers/student-answer-table/hooks/useTableDataGeneration"
import type { ExtendedDisabledState } from "@/components/projects/06-student-answers/student-answer-table/types"
import {
  calculateDynamicDisabledPositions,
  calculatePositionsWithExistingAnswers,
  getDisabledFiles,
  getEnabledFiles,
  getFileColor,
  sortStudentsByCustomOrder,
} from "@/components/projects/06-student-answers/student-answer-table/utils/tableDataUtils"
import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
} from "@/components/projects/06-student-answers/types"

interface UseTableDataParams {
  files: UnifiedFile[]
  students: UnifiedStudent[]
  modelAnswerCount: number
  fileOrder: PlacementStrategy
  disabledState: ExtendedDisabledState
  isPositionDisabled: (studentIndex: number, pageIndex: number) => boolean
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
  isPositionDisabled,
  mode,
  existingStudentAnswers,
  allowOverwrite = false,
}: UseTableDataParams) {
  // 生徒のソート（customOrder準拠）
  const sortedStudents = useMemo(() => {
    return sortStudentsByCustomOrder(students)
  }, [students])

  // 動的無効化位置の計算
  const dynamicDisabledPositions = useMemo(() => {
    return calculateDynamicDisabledPositions(
      files,
      sortedStudents,
      modelAnswerCount,
      disabledState,
      mode
    )
  }, [files, sortedStudents, modelAnswerCount, disabledState, mode])

  // 拡張されたisPositionDisabled関数
  const enhancedIsPositionDisabled = useCallback(
    (studentIndex: number, pageIndex: number) => {
      const position = studentIndex * modelAnswerCount + pageIndex

      // 元の無効化チェック
      if (isPositionDisabled(studentIndex, pageIndex)) return true

      // 動的無効化チェック
      return dynamicDisabledPositions.has(position)
    },
    [isPositionDisabled, modelAnswerCount, dynamicDisabledPositions]
  )

  // 既存答案がある位置の計算（警告オーバーレイ用）
  const positionsWithExistingAnswers = useMemo(() => {
    return calculatePositionsWithExistingAnswers(
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
  const getFileColorCallback = useCallback((file: UnifiedFile) => {
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
    enhancedIsPositionDisabled,
    allowOverwrite,
    existingStudentAnswers,
  })

  return {
    sortedStudents,
    getEnabledFiles: getEnabledFilesCallback,
    getDisabledFiles: getDisabledFilesCallback,
    getFileColor: getFileColorCallback,
    tableData,
    positionsWithExistingAnswers,
  }
}
