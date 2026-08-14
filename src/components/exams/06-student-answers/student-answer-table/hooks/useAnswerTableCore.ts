import { useMutation } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { useDisabledState } from "@/components/exams/06-student-answers/student-answer-table/hooks/useDisabledState"
import { useDragDrop } from "@/components/exams/06-student-answers/student-answer-table/hooks/useDragDrop"
import { useNameRegion } from "@/components/exams/06-student-answers/student-answer-table/hooks/useNameRegion"
import { useTableData } from "@/components/exams/06-student-answers/student-answer-table/hooks/useTableData"
import type { PreviewMode } from "@/components/exams/06-student-answers/student-answer-table/types"
import type { FileState } from "@/components/exams/06-student-answers/student-answer-table/types"
import type {
  AnswerImageIdentity,
  ExamPageColumn,
  PlacementStrategy,
} from "@/components/exams/06-student-answers/types"
import { deleteStudentAnswerMutation } from "@/queries/answerSheet"
import type { StudentAnswerDatasetExamStudent } from "@/types/prismaExtensions"

/**
 * upload / view の両テーブルが共有する中核ロジック（DnD・無効状態・テーブルデータ生成・
 * 削除・氏名領域）。マーカー補正と handleUpload は未保存項目（UnsavedAnswerImage）を要するため
 * upload 側のラッパー（UploadAnswerTable）が担い、ここには置かない（型の false merge を避ける）。
 */
interface UseAnswerTableCoreParams<TItem extends AnswerImageIdentity> {
  examId: string
  students: StudentAnswerDatasetExamStudent[]
  files: TItem[]
  examPages: ExamPageColumn[]
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
  existingAnswers?: AnswerImageIdentity[]
}

export function useAnswerTableCore<TItem extends AnswerImageIdentity>({
  examId,
  students,
  files,
  examPages,
  fileOrder = "page-first",
  mode = "upload",
  onFilesChange,
  onReloadData,
  onUpdatePendingChanges,
  existingAnswers = [],
}: UseAnswerTableCoreParams<TItem>) {
  const {
    nameRegionExamPageIds,
    canvasRef,
    drawNameRegionCanvas,
  } = useNameRegion(examId)

  const {
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
  } = useDisabledState({ students, examPages })

  const {
    getEnabledFiles,
    getDisabledFiles,
    tableRows,
    orphanItems,
    unplacedItems,
    cellsWithExistingAnswers,
  } = useTableData<TItem>({
    files,
    students,
    examPages,
    fileOrder,
    disabledState,
    isCellDisabled,
    mode,
    existingAnswers,
    allowOverwrite,
  })

  const { sensors, activeFile, handleDragStart, handleDragEnd } =
    useDragDrop<TItem>({
      files,
      onFilesChange,
      getEnabledFiles,
      getDisabledFiles,
      students,
      examPages,
      mode,
      fileOrder,
      onReloadData,
      onUpdatePendingChanges,
      existingAnswers,
    })

  const [previewMode, setPreviewMode] = useState<PreviewMode>("full")
  const deleteStudentAnswer = useMutation(deleteStudentAnswerMutation(examId))

  // 答案削除処理（view の右クリックメニューから使用。upload では削除UIは出さない）
  const handleDeleteAnswerSheet = useCallback(
    async (fileId: string) => {
      try {
        const { deletedSummary } =
          await deleteStudentAnswer.mutateAsync(fileId)

        // 件数は出さない（未採点の初期化行を含む行数とモーダルの表示件数がずれるため）
        toast.success(
          deletedSummary.hasScoreData
            ? "答案画像と採点データを削除しました"
            : "答案画像を削除しました"
        )
      } catch {
        // 失敗の知らせは中央のトーストが出す
      }
    },
    [deleteStudentAnswer]
  )

  // 答案がない生徒の自動無効化（DBベース）
  useEffect(() => {
    initializeStudentsWithoutAnswers()
  }, [initializeStudentsWithoutAnswers])

  const handlePreviewModeChange = (nextPreviewMode: PreviewMode) => {
    setPreviewMode(nextPreviewMode)
  }

  const maxPages = examPages.length
  const trashFiles = getDisabledFiles()
  const hasNameRegion = nameRegionExamPageIds.size > 0

  return {
    // 氏名領域
    nameRegionExamPageIds,
    canvasRef,
    drawNameRegionCanvas,
    // 無効状態
    disabledState,
    toggleRowDisabled,
    toggleColDisabled,
    disableRowsExcept,
    disableColsExcept,
    enableAllRows,
    enableAllCols,
    toggleCellDisabled,
    toggleFileDisabled,
    allowOverwrite,
    setAllowOverwrite,
    // テーブルデータ
    getEnabledFiles,
    tableRows,
    orphanItems,
    unplacedItems,
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
