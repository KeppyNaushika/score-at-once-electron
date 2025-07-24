import {
  useDisabledState,
  useDragDrop,
  useNameRegion,
  useTableData,
} from "@/components/projects/06-answer-sheets/answer-sheet-table/hooks"
import type { PreviewMode } from "@/components/projects/06-answer-sheets/answer-sheet-table/types"
import type { AnswerSheetTableProps, UploadModalState } from "@/components/projects/06-answer-sheets/answer-sheet-table/types/local-types"
import type { UploadData } from "@/types/answer-sheet.types"
import { useEffect, useState } from "react"

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
  onResetDragDrop,
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
    setDisabledState,
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
    allowOverwrite,
    existingAnswerSheets,
  })

  const {
    sensors,
    activeFile,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    resetToInitialState,
  } = useDragDrop({
    files,
    onFilesChange,
    getEnabledFiles,
    getDisabledFiles,
    disabledState,
    setDisabledState,
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
  // Effects
  // ============================================================================

  // コールバック関数をプロップとして渡すためのuseEffect
  useEffect(() => {
    if (onResetDragDrop) {
      onResetDragDrop.current = resetToInitialState
    }
  }, [onResetDragDrop, resetToInitialState])

  // 氏名領域の可用性チェック
  useEffect(() => {
    checkNameRegionAvailability()
  }, [checkNameRegionAvailability])

  // 答案がない生徒の自動無効化（DBベース）
  useEffect(() => {
    initializeStudentsWithoutAnswers(students, files)
  }, [students, files, initializeStudentsWithoutAnswers])

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

  const handleUploadToCell = (file: File, pageNumber: number) => {
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
    handleDragOver,
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

    // 計算済みプロパティ
    maxPages,
    trashFiles,
    hasNameRegion,
  }
}