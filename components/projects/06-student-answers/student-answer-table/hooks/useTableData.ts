import { useTableDataGeneration } from "@/components/projects/06-answer-sheets/answer-sheet-table/hooks/useTableDataGeneration"
import type { ExtendedDisabledState } from "@/components/projects/06-answer-sheets/answer-sheet-table/types"
import {
  calculateDynamicDisabledPositions,
  calculatePositionsWithExistingAnswers,
  getDisabledFiles,
  getEnabledFiles,
  getFileColor,
  sortStudentsByCustomOrder,
} from "@/components/projects/06-answer-sheets/answer-sheet-table/utils/table-data-utils"
import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
} from "@/types/answer-sheet.types"
import { useCallback, useMemo } from "react"

interface UseTableDataParams {
  files: UnifiedFile[]
  students: UnifiedStudent[]
  masterImageCount: number
  fileOrder: PlacementStrategy
  disabledState: ExtendedDisabledState
  isPositionDisabled: (studentIndex: number, pageIndex: number) => boolean
  mode?: "upload" | "view"
  existingAnswerSheets?: Array<{
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
  masterImageCount,
  fileOrder,
  disabledState,
  isPositionDisabled,
  mode,
  existingAnswerSheets,
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
      masterImageCount,
      disabledState,
      mode,
    )
  }, [files, sortedStudents, masterImageCount, disabledState, mode])

  // 拡張されたisPositionDisabled関数
  const enhancedIsPositionDisabled = useCallback(
    (studentIndex: number, pageIndex: number) => {
      const position = studentIndex * masterImageCount + pageIndex

      // 元の無効化チェック
      if (isPositionDisabled(studentIndex, pageIndex)) return true

      // 動的無効化チェック
      return dynamicDisabledPositions.has(position)
    },
    [isPositionDisabled, masterImageCount, dynamicDisabledPositions],
  )

  // 既存答案がある位置の計算（警告オーバーレイ用）
  const positionsWithExistingAnswers = useMemo(() => {
    return calculatePositionsWithExistingAnswers(
      files,
      sortedStudents,
      masterImageCount,
      disabledState,
      mode,
      existingAnswerSheets,
    )
  }, [
    files,
    sortedStudents,
    masterImageCount,
    disabledState,
    mode,
    existingAnswerSheets,
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
    masterImageCount,
    fileOrder,
    disabledState,
    mode,
    enhancedIsPositionDisabled,
    allowOverwrite,
    existingAnswerSheets,
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
