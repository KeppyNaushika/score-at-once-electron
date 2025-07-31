import { useDisabledState } from "@/components/projects/06-student-answers/student-answer-table/hooks/useDisabledState"
import { useDragDrop } from "@/components/projects/06-student-answers/student-answer-table/hooks/useDragDrop"
import { useNameRegion } from "@/components/projects/06-student-answers/student-answer-table/hooks/useNameRegion"
import { useTableData } from "@/components/projects/06-student-answers/student-answer-table/hooks/useTableData"
import type { PreviewMode } from "@/components/projects/06-student-answers/student-answer-table/types"
import type {
  AnswerSheetTableProps,
  UploadModalState,
} from "@/components/projects/06-student-answers/student-answer-table/types/local-types"
import type { UploadData } from "@/types/student-answer.types"
import { useCallback, useEffect, useState } from "react"

/**
 * AnswerSheetTableのメインロジックを管理するカスタムフック
 */
export function useAnswerSheetTableLogic({
  projectId,
  students,
  files,
  masterImageCount,
  fileOrder = "page-first",
  mode = "upload",
  onFilesChange,
  onUpload,
  onReloadData,
  onUpdatePendingChanges,
  existingAnswerSheets = [],
}: AnswerSheetTableProps) {
  // ============================================================================
  // カスタムフック
  // ============================================================================

  const {
    nameRegionAvailable,
    canvasRef,
    checkNameRegionAvailability,
    drawNameRegionCanvas,
  } = useNameRegion(projectId)

  const {
    disabledState,
    toggleRowDisabled,
    toggleColDisabled,
    togglePositionDisabled,
    toggleFileDisabled,
    isPositionDisabled,
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
    positionsWithExistingAnswers,
  } = useTableData({
    files,
    students,
    masterImageCount,
    fileOrder,
    disabledState,
    isPositionDisabled,
    mode,
    existingAnswerSheets,
    allowOverwrite,
  })

  const { sensors, activeFile, handleDragStart, handleDragEnd } = useDragDrop({
    files,
    onFilesChange,
    getEnabledFiles,
    getDisabledFiles,
    students,
    masterImageCount,
    mode,
    fileOrder,
    onReloadData,
    onUpdatePendingChanges,
  })

  // ============================================================================
  // ローカルState
  // ============================================================================

  const [previewMode, setPreviewMode] = useState<PreviewMode>("full")
  const [uploadModalState, setUploadModalState] = useState<UploadModalState>({
    isOpen: false,
  })

  // ============================================================================
  // 削除処理
  // ============================================================================

  // 答案削除処理
  const handleDeleteAnswerSheet = useCallback(
    async (fileId: string) => {
      try {
        // UnifiedFileから対応するAnswerSheetのIDを特定
        // 既存答案の場合はfileIdがAnswerSheetのIDと一致
        const result = await window.electronAPI.deleteStudentAnswer(fileId)

        if (result.success) {
          // 削除成功時はデータを再読み込み
          if (onReloadData) {
            onReloadData()
          }
          // TODO: 成功通知を追加
        } else {
          console.error("答案削除エラー:", result.error)
          // TODO: エラー通知を追加
        }
      } catch (error) {
        console.error("答案削除例外:", error)
        // TODO: エラー通知を追加
      }
    },
    [onReloadData],
  )

  // ============================================================================
  // Effects
  // ============================================================================

  // 氏名領域の可用性チェック
  useEffect(() => {
    checkNameRegionAvailability()
  }, [checkNameRegionAvailability])

  // 答案がない生徒の自動無効化（DBベース）
  useEffect(() => {
    initializeStudentsWithoutAnswers(students)
  }, [students, initializeStudentsWithoutAnswers])

  // ============================================================================
  // イベントハンドラー
  // ============================================================================

  const handlePreviewModeChange = (mode: PreviewMode) => {
    setPreviewMode(mode)
  }

  const handleUpload = () => {
    const uploadData: UploadData[] = []

    // 動的テーブルデータから配置済みファイルのアップロードデータを生成
    tableData.forEach((row) => {
      row.forEach((cell) => {
        if (
          cell.type === "file" &&
          cell.file &&
          cell.student &&
          cell.pageNumber
        ) {
          uploadData.push({
            name: cell.file.name,
            fileName: cell.file.name,
            originalFileName: cell.file.originalFileName,
            type: cell.file.type,
            buffer: cell.file.buffer,
            studentId: cell.student.id,
            pageNumber: cell.pageNumber,
            overwrite: false,
          })
        }
      })
    })

    onUpload(uploadData)
  }

  const handleUploadModalOpen = (
    position: number,
    studentName: string | undefined,
    pageNumber: number | undefined,
  ) => {
    setUploadModalState({
      isOpen: true,
      position,
      studentName,
      pageNumber,
    })
  }

  const handleUploadModalClose = () => {
    setUploadModalState({ isOpen: false })
  }

  const handleUploadToCell = (file: File, pageNumber?: number) => {
    // TODO: 指定されたセル位置にファイルをアップロード
    console.log(
      `Uploading to position ${uploadModalState.position}:`,
      file.name,
      pageNumber,
    )
    setUploadModalState({ isOpen: false })
  }

  // ============================================================================
  // 計算済みプロパティ
  // ============================================================================

  const maxPages = masterImageCount
  const trashFiles = getDisabledFiles()
  const hasNameRegion = Object.values(nameRegionAvailable).some(Boolean)

  return {
    // フック結果
    nameRegionAvailable,
    canvasRef,
    drawNameRegionCanvas,
    disabledState,
    toggleRowDisabled,
    toggleColDisabled,
    togglePositionDisabled,
    toggleFileDisabled,
    sortedStudents,
    getEnabledFiles,
    getDisabledFiles,
    getFileColor,
    tableData,
    positionsWithExistingAnswers,
    sensors,
    activeFile,
    handleDragStart,
    handleDragEnd,
    allowOverwrite,
    setAllowOverwrite,

    // ローカル状態
    previewMode,
    uploadModalState,

    // イベントハンドラー
    handlePreviewModeChange,
    handleUpload,
    handleUploadModalOpen,
    handleUploadModalClose,
    handleUploadToCell,
    handleDeleteAnswerSheet,

    // 計算済みプロパティ
    maxPages,
    trashFiles,
    hasNameRegion,
  }
}
