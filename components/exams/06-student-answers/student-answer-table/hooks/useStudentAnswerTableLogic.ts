import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { useDisabledState } from "@/components/exams/06-student-answers/student-answer-table/hooks/useDisabledState"
import { useDragDrop } from "@/components/exams/06-student-answers/student-answer-table/hooks/useDragDrop"
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
    modelAnswerCount,
    fileOrder,
    disabledState,
    isPositionDisabled,
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
  })

  // ============================================================================
  // ローカルState
  // ============================================================================

  const [previewMode, setPreviewMode] = useState<PreviewMode>("full")
  const [uploadModalState, setUploadModalState] = useState<UploadModalState>({
    isOpen: false,
  })
  const [markerCorrectionEnabled, setMarkerCorrectionEnabled] = useState(false)
  const [markerCorrectionAvailable, setMarkerCorrectionAvailable] =
    useState(false)

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

  // マスター画像のマーカー検出（マーカー補正の利用可否判定）
  useEffect(() => {
    if (mode !== "upload" || !examId) return

    let cancelled = false
    ;(async () => {
      try {
        const result = await window.electronAPI.omr.detectMasterMarkers(examId)
        if (!cancelled) {
          setMarkerCorrectionAvailable(result.success)
          if (!result.success) {
            setMarkerCorrectionEnabled(false)
          }
        }
      } catch {
        if (!cancelled) {
          setMarkerCorrectionAvailable(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [examId, mode])

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
            overwrite: allowOverwrite,
            correctWithMarkers: markerCorrectionEnabled,
          })
        }
      })
    })

    onUpload(uploadData)
  }

  const handleUploadModalOpen = (
    position: number,
    studentName: string | undefined,
    pageNumber: number | undefined
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
    togglePositionDisabled,
    toggleFileDisabled,
    sortedStudents,
    getEnabledFiles,
    getFileColor,
    tableData,
    positionsWithExistingAnswers,
    sensors,
    activeFile,
    handleDragStart,
    handleDragEnd,
    allowOverwrite,
    setAllowOverwrite,
    markerCorrectionEnabled,
    markerCorrectionAvailable,
    setMarkerCorrectionEnabled,

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
