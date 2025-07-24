"use client"

import { useCallback, useEffect } from "react"
import { PasswordDialog } from "@/components/ui/password-dialog"
import {
  FileUploadZone,
  AnswerSheetGridManager,
} from "@/components/projects/06-answer-sheets/answer-sheet-management/components"
import { useAnswerSheetUpload } from "@/components/projects/06-answer-sheets/answer-sheet-management/hooks"
import type { AnswerSheetUploadProps } from "@/components/projects/06-answer-sheets/answer-sheet-management/types"
import type { PlacementStrategy } from "@/types/answer-sheet.types"
// table-dnd-kit-test準拠のコンポーネントも併用
import { AnswerSheetTable } from "@/components/projects/06-answer-sheets/answer-sheet-table"
import { convertAnswerSheetsToFiles } from "@/components/projects/06-answer-sheets/answer-sheet-management/utils/convertAnswerSheetsToFiles"
import { buildOrderedFileArrayFromAnswerSheets, reorderFilesByStrategy } from "@/components/projects/06-answer-sheets/answer-sheet-management/utils/reorderFilesByStrategy"

export function AnswerSheetUpload({
  projectId,
  students,
  masterImageCount,
  onUploadComplete,
  existingAnswerSheets,
  mode = "upload",
  pendingChanges,
  affectedCells,
  onUpdatePendingChanges,
  onResetDragDrop,
}: AnswerSheetUploadProps) {
  const {
    // State
    isUploading,
    isConverting,
    files,
    pdfProcessingProgress,
    fileOrder,
    uploadProgress,
    passwordDialog,
    imageLoadStates,
    observerRef,

    // Actions
    setFiles,
    setFileOrder,
    setPasswordDialog,
    handleDrop,
    handleUpload,
  } = useAnswerSheetUpload(projectId, students, onUploadComplete)

  // 確認モード用の初期化処理
  useEffect(() => {
    if (mode === "view" && existingAnswerSheets && files.length === 0) {
      // 初回のみ既存答案を配置戦略に基づいて配列構築
      const initialFiles = buildOrderedFileArrayFromAnswerSheets(
        existingAnswerSheets, 
        students, 
        masterImageCount, 
        fileOrder
      )
      setFiles(initialFiles)
    }
  }, [mode, existingAnswerSheets, files.length, students, masterImageCount, fileOrder, setFiles])

  // 確認モード用の配置戦略変更ハンドラー
  const handleFileOrderChangeInViewMode = useCallback((newFileOrder: PlacementStrategy) => {
    if (mode === "view" && files.length > 0) {
      // 現在のファイル配列を新しい配置戦略で再配置
      const reorderedFiles = reorderFilesByStrategy(
        files,
        students,
        masterImageCount,
        newFileOrder
      )
      setFiles(reorderedFiles)
    }
    setFileOrder(newFileOrder)
  }, [mode, files, students, masterImageCount, setFiles, setFileOrder])

  // 表示モードでは既存の答案をテーブル表示
  if (mode === "view" && existingAnswerSheets) {

    return (
      <AnswerSheetTable
        projectId={projectId}
        students={students}
        files={files}
        masterImageCount={masterImageCount}
        fileOrder={fileOrder}
        isUploading={false} // 確認モードではアップロード不可
        onFileOrderChange={handleFileOrderChangeInViewMode}
        onFilesChange={setFiles}
        onUpload={handleUpload}
        imageLoadStates={imageLoadStates}
        observerRef={observerRef}
        mode="view"
        onReloadData={onUploadComplete}
        pendingChanges={pendingChanges}
        affectedCells={affectedCells}
        onUpdatePendingChanges={onUpdatePendingChanges}
        onResetDragDrop={onResetDragDrop}
        existingAnswerSheets={existingAnswerSheets}
      />
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* ファイルアップロードゾーン */}
      <FileUploadZone
        onDrop={handleDrop}
        isConverting={isConverting}
        disabled={isUploading}
        masterImageCount={masterImageCount}
        pdfProcessingProgress={pdfProcessingProgress}
      />

      {/* 答案配置テーブル */}
      <div className="min-h-0 flex-1">
        <AnswerSheetTable
          projectId={projectId}
          students={students}
          files={files}
          masterImageCount={masterImageCount}
          fileOrder={fileOrder}
          isUploading={isUploading}
          onFileOrderChange={setFileOrder}
          onFilesChange={setFiles}
          onUpload={handleUpload}
          imageLoadStates={imageLoadStates}
          observerRef={observerRef}
          mode={mode}
          onReloadData={onUploadComplete}
          onResetDragDrop={onResetDragDrop}
          existingAnswerSheets={existingAnswerSheets}
        />
      </div>

      {/* PDFパスワードダイアログ */}
      <PasswordDialog
        isOpen={passwordDialog.isOpen}
        onClose={passwordDialog.onCancel}
        onSubmit={passwordDialog.onSubmit}
        fileName={passwordDialog.filename}
      />
    </div>
  )
}
