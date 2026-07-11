import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { useDisabledState } from "@/components/exams/06-student-answers/student-answer-table/hooks/useDisabledState"
import { useDragDrop } from "@/components/exams/06-student-answers/student-answer-table/hooks/useDragDrop"
import { useMarkerCorrection } from "@/components/exams/06-student-answers/student-answer-table/hooks/useMarkerCorrection"
import { useNameRegion } from "@/components/exams/06-student-answers/student-answer-table/hooks/useNameRegion"
import { useTableData } from "@/components/exams/06-student-answers/student-answer-table/hooks/useTableData"
import type { PreviewMode } from "@/components/exams/06-student-answers/student-answer-table/types"
import type {
  StudentAnswerTableProps,
  UploadModalState,
} from "@/components/exams/06-student-answers/student-answer-table/types/localTypes"
import type { UploadData } from "@/components/exams/06-student-answers/types"

/**
 * StudentAnswerTableのメインロジックを管理するカスタムフック
 */
export function useStudentAnswerTableLogic({
  examId,
  students,
  files,
  modelAnswerCount,
  fileOrder = "page-first",
  mode = "upload",
  onFilesChange,
  onUpload,
  onReloadData,
  onUpdatePendingChanges,
  existingStudentAnswers = [],
  markerCorrectionEnabled: markerCorrectionEnabledProp,
  markerCorrectionAvailable: markerCorrectionAvailableProp,
  markerDiagnostics: markerDiagnosticsProp,
  markerAvailablePages: markerAvailablePagesProp,
  onMarkerCorrectionChange,
}: StudentAnswerTableProps) {
  // ============================================================================
  // カスタムフック
  // ============================================================================

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
    cellsWithExistingAnswers,
  } = useTableData({
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

  const { sensors, activeFile, handleDragStart, handleDragEnd } = useDragDrop({
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

  // ============================================================================
  // ローカルState
  // ============================================================================

  const [previewMode, setPreviewMode] = useState<PreviewMode>("full")
  const [uploadModalState, setUploadModalState] = useState<UploadModalState>({
    isOpen: false,
  })
  // マーカー補正状態は親フック（useStudentAnswerUpload）から注入される
  const markerCorrectionEnabled = markerCorrectionEnabledProp ?? false
  const markerCorrectionAvailable = markerCorrectionAvailableProp ?? false
  const markerDiagnostics = markerDiagnosticsProp ?? ""
  const markerAvailablePages = markerAvailablePagesProp ?? new Set<number>()
  const setMarkerCorrectionEnabled = onMarkerCorrectionChange ?? (() => {})

  // 配置戦略に応じた動的マーカー補正
  const { correctingFileIds } = useMarkerCorrection({
    examId,
    files,
    tableData,
    markerCorrectionEnabled,
    markerAvailablePages,
    onFilesChange,
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

    // 動的テーブルデータから配置済みファイルのアップロードデータを生成。
    // 生徒とページはセル座標 [studentIndex][pageIndex] から投射する。
    tableData.forEach((row, studentIndex) => {
      row.forEach((cell, pageIndex) => {
        // 未保存画像のみ本物の buffer を持つ（DB答案は buffer なし＝アップロード対象外）。
        if (cell.type === "file" && cell.file && cell.file.buffer) {
          const examStudent = sortedStudents[studentIndex]
          uploadData.push({
            name: cell.file.name,
            fileName: cell.file.name,
            originalFileName: cell.file.originalFileName,
            type: cell.file.type,
            buffer: cell.file.buffer,
            studentId: examStudent.studentId,
            pageNumber: pageIndex + 1,
            overwrite: allowOverwrite,
            correctWithMarkers: false, // クライアント側で補正済み
            correctionStatus: cell.file.correctionStatus,
          })
        }
      })
    })

    onUpload(uploadData)
  }

  const handleUploadModalOpen = (
    studentName: string | undefined,
    pageNumber: number | undefined
  ) => {
    setUploadModalState({
      isOpen: true,
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
      `Uploading to ${uploadModalState.studentName ?? "?"} p${uploadModalState.pageNumber ?? "?"}:`,
      file.name,
      pageNumber
    )
    setUploadModalState({ isOpen: false })
  }

  // ============================================================================
  // 計算済みプロパティ
  // ============================================================================

  const maxPages = modelAnswerCount
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
    toggleCellDisabled,
    toggleFileDisabled,
    sortedStudents,
    getEnabledFiles,
    getFileColor,
    tableData,
    cellsWithExistingAnswers,
    sensors,
    activeFile,
    handleDragStart,
    handleDragEnd,
    allowOverwrite,
    setAllowOverwrite,
    markerCorrectionEnabled,
    markerCorrectionAvailable,
    markerDiagnostics,
    setMarkerCorrectionEnabled,
    correctingFileIds,

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
