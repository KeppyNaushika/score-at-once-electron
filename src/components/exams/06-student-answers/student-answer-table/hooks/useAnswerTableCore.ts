import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { useDisabledState } from "@/components/exams/06-student-answers/student-answer-table/hooks/useDisabledState"
import { useDragDrop } from "@/components/exams/06-student-answers/student-answer-table/hooks/useDragDrop"
import { useNameRegion } from "@/components/exams/06-student-answers/student-answer-table/hooks/useNameRegion"
import { useTableData } from "@/components/exams/06-student-answers/student-answer-table/hooks/useTableData"
import type { PreviewMode } from "@/components/exams/06-student-answers/student-answer-table/types"
import type { FileState } from "@/components/exams/06-student-answers/student-answer-table/types/dragDropTypes"
import type {
  AnswerItem,
  PlacementStrategy,
} from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

/**
 * upload / view の両テーブルが共有する中核ロジック（DnD・無効状態・テーブルデータ生成・
 * 削除・氏名領域）。マーカー補正と handleUpload は PendingImage を要するため upload 側の
 * ラッパー（UploadAnswerTable）が担い、ここには置かない（型の false merge を避ける）。
 */
export interface UseAnswerTableCoreParams<TItem extends AnswerItem> {
  examId: string
  students: ExamStudentWithMemberships[]
  files: TItem[]
  modelAnswerCount: number
  fileOrder?: PlacementStrategy
  mode?: "upload" | "view"
  onFilesChange: (files: TItem[]) => void
  onReloadData?: () => void
  onUpdatePendingChanges?: (
    changedFiles: Array<{
      fileId: string
      fromState: FileState
      toState: FileState
    }>
  ) => void
  existingStudentAnswers?: Array<{
    id: string
    studentId: string | null
    pageNumber: number
  }>
}

export function useAnswerTableCore<TItem extends AnswerItem>({
  examId,
  students,
  files,
  modelAnswerCount,
  fileOrder = "page-first",
  mode = "upload",
  onFilesChange,
  onReloadData,
  onUpdatePendingChanges,
  existingStudentAnswers = [],
}: UseAnswerTableCoreParams<TItem>) {
  const {
    nameRegionAvailable,
    canvasRef,
    checkNameRegionAvailability,
    drawNameRegionCanvas,
  } = useNameRegion(examId)

  const {
    disabledState,
    toggleRowDisabled,
    toggleColDisabled,
    toggleCellDisabled,
    toggleFileDisabled,
    isCellDisabled,
    initializeStudentsWithoutAnswers,
    allowOverwrite,
    setAllowOverwrite,
  } = useDisabledState()

  const {
    sortedStudents,
    getEnabledFiles,
    getDisabledFiles,
    getFileColor,
    tableData,
    orphanItems,
    cellsWithExistingAnswers,
  } = useTableData<TItem>({
    files,
    students,
    modelAnswerCount,
    fileOrder,
    disabledState,
    isCellDisabled,
    mode,
    existingStudentAnswers,
    allowOverwrite,
  })

  const { sensors, activeFile, handleDragStart, handleDragEnd } =
    useDragDrop<TItem>({
      files,
      onFilesChange,
      getEnabledFiles,
      getDisabledFiles,
      students,
      modelAnswerCount,
      mode,
      fileOrder,
      onReloadData,
      onUpdatePendingChanges,
      existingStudentAnswers,
    })

  const [previewMode, setPreviewMode] = useState<PreviewMode>("full")

  // 答案削除処理（view の右クリックメニューから使用。upload では削除UIは出さない）
  const handleDeleteAnswerSheet = useCallback(
    async (fileId: string) => {
      try {
        const result = await window.electronAPI.deleteStudentAnswer(fileId)

        if (result.success) {
          if (onReloadData) {
            await onReloadData()
          }
          toast.success("答案画像を削除しました")
        } else {
          console.error("答案削除エラー:", result.error)
          toast.error(result.error || "答案削除に失敗しました")
        }
      } catch (error) {
        console.error("答案削除例外:", error)
        toast.error("答案削除に失敗しました")
      }
    },
    [onReloadData]
  )

  // 氏名領域の可用性チェック
  useEffect(() => {
    checkNameRegionAvailability()
  }, [checkNameRegionAvailability])

  // 答案がない生徒の自動無効化（DBベース）
  useEffect(() => {
    initializeStudentsWithoutAnswers(students)
  }, [students, initializeStudentsWithoutAnswers])

  const handlePreviewModeChange = (nextPreviewMode: PreviewMode) => {
    setPreviewMode(nextPreviewMode)
  }

  const maxPages = modelAnswerCount
  const trashFiles = getDisabledFiles()
  const hasNameRegion = Object.values(nameRegionAvailable).some(Boolean)

  return {
    // 氏名領域
    nameRegionAvailable,
    canvasRef,
    drawNameRegionCanvas,
    // 無効状態
    disabledState,
    toggleRowDisabled,
    toggleColDisabled,
    toggleCellDisabled,
    toggleFileDisabled,
    allowOverwrite,
    setAllowOverwrite,
    // テーブルデータ
    sortedStudents,
    getEnabledFiles,
    getFileColor,
    tableData,
    orphanItems,
    cellsWithExistingAnswers,
    // DnD
    sensors,
    activeFile,
    handleDragStart,
    handleDragEnd,
    // 表示状態
    previewMode,
    handlePreviewModeChange,
    handleDeleteAnswerSheet,
    // 計算済み
    maxPages,
    trashFiles,
    hasNameRegion,
  }
}
