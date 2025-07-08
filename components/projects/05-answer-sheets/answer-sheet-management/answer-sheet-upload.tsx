"use client"

import { PasswordDialog } from "@/components/ui/password-dialog"
import { FileUploadZone, AnswerSheetGridManager } from "@/components/projects/05-answer-sheets/answer-sheet-management/components"
import { useAnswerSheetUpload } from "@/components/projects/05-answer-sheets/answer-sheet-management/hooks"
import type { AnswerSheetUploadProps } from "@/components/projects/05-answer-sheets/answer-sheet-management/types"
// table-dnd-kit-test準拠のコンポーネントも併用
import { AnswerSheetTable } from "@/components/projects/05-answer-sheets/answer-sheet-table"
import { convertAnswerSheetsToFiles } from "@/components/projects/05-answer-sheets/answer-sheet-management/utils/convertAnswerSheetsToFiles"

export function AnswerSheetUpload({
  projectId,
  students,
  masterImageCount,
  onUploadComplete,
  existingAnswerSheets,
  mode = "upload",
  pendingChanges,
  affectedCells,
  onAddPendingChange,
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

  // 表示モードでは既存の答案をテーブル表示
  if (mode === "view" && existingAnswerSheets) {
    // 既存答案をUnifiedFile形式に変換
    const existingFiles = convertAnswerSheetsToFiles(existingAnswerSheets)
    
    return (
      <AnswerSheetTable
        projectId={projectId}
        students={students}
        files={existingFiles}
        masterImageCount={masterImageCount}
        fileOrder={fileOrder}
        isUploading={false} // 確認モードではアップロード不可
        onFileOrderChange={setFileOrder}
        onFilesChange={setFiles}
        onUpload={handleUpload}
        imageLoadStates={imageLoadStates}
        observerRef={observerRef}
        mode="view"
        onReloadData={onUploadComplete}
        pendingChanges={pendingChanges}
        affectedCells={affectedCells}
        onAddPendingChange={onAddPendingChange}
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