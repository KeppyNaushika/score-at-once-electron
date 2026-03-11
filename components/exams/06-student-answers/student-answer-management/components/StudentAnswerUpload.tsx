"use client"

import { useCallback, useEffect } from "react"

import { FileUploadZone } from "@/components/exams/06-student-answers/student-answer-management/components/FileUploadZone"
import { useStudentAnswerUpload } from "@/components/exams/06-student-answers/student-answer-management/hooks/useStudentAnswerUpload"
import type { StudentAnswerUploadProps } from "@/components/exams/06-student-answers/student-answer-management/types"
import {
  buildOrderedFileArrayFromStudentAnswers,
  reorderFilesByStrategy,
} from "@/components/exams/06-student-answers/student-answer-management/utils/reorderFilesByStrategy"
import { StudentAnswerTable } from "@/components/exams/06-student-answers/student-answer-table/components/StudentAnswerTable"
import type { PlacementStrategy } from "@/components/exams/06-student-answers/types"
import { PasswordDialog } from "@/components/ui/password-dialog"

export function StudentAnswerUpload({
  examId,
  students,
  modelAnswerCount,
  onUploadComplete,
  existingStudentAnswers,
  mode = "upload",
  pendingChanges,
  affectedCells,
  onUpdatePendingChanges,
  onUploadFileCountChange,
}: StudentAnswerUploadProps) {
  const finalModelAnswerCount = modelAnswerCount
  const finalExistingAnswers = existingStudentAnswers
  const {
    // State
    isUploading,
    isConverting,
    files,
    pdfProcessingProgress,
    fileOrder,
    passwordDialog,
    observerRef,

    // Actions
    setFiles,
    setFileOrder,
    handleDrop,
    handleUpload,
  } = useStudentAnswerUpload(examId, onUploadComplete)

  // 確認モード用の初期化処理
  useEffect(() => {
    if (mode === "view" && finalExistingAnswers && files.length === 0) {
      // 初回のみ既存答案を配置戦略に基づいて配列構築
      const initialFiles = buildOrderedFileArrayFromStudentAnswers(
        finalExistingAnswers,
        students,
        finalModelAnswerCount,
        fileOrder
      )
      setFiles(initialFiles)
    }
  }, [
    mode,
    finalExistingAnswers,
    files.length,
    students,
    finalModelAnswerCount,
    fileOrder,
    setFiles,
  ])

  // ナビゲーションガード用: アップロード待ちファイル数の通知
  useEffect(() => {
    if (mode === "upload" && onUploadFileCountChange) {
      onUploadFileCountChange(files.length)
    }
  }, [mode, files.length, onUploadFileCountChange])

  // 確認モード用の配置戦略変更ハンドラー
  const handleFileOrderChangeInViewMode = useCallback(
    (newFileOrder: PlacementStrategy) => {
      if (mode === "view" && files.length > 0) {
        // 現在のファイル配列を新しい配置戦略で再配置
        const reorderedFiles = reorderFilesByStrategy(
          files,
          students,
          finalModelAnswerCount,
          newFileOrder
        )
        setFiles(reorderedFiles)
      }
      setFileOrder(newFileOrder)
    },
    [mode, files, students, finalModelAnswerCount, setFiles, setFileOrder]
  )

  // 表示モードでは既存の答案をテーブル表示
  if (mode === "view" && finalExistingAnswers) {
    return (
      <StudentAnswerTable
        examId={examId}
        students={students}
        files={files}
        modelAnswerCount={finalModelAnswerCount}
        fileOrder={fileOrder}
        isUploading={false} // 確認モードではアップロード不可
        onFileOrderChange={handleFileOrderChangeInViewMode}
        onFilesChange={setFiles}
        onUpload={handleUpload}
        observerRef={observerRef}
        mode="view"
        onReloadData={onUploadComplete}
        pendingChanges={pendingChanges}
        affectedCells={affectedCells}
        onUpdatePendingChanges={onUpdatePendingChanges}
        existingStudentAnswers={finalExistingAnswers}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ファイルアップロードゾーン */}
      <FileUploadZone
        onDrop={handleDrop}
        isConverting={isConverting}
        disabled={isUploading}
        modelAnswerCount={finalModelAnswerCount}
        pdfProcessingProgress={pdfProcessingProgress}
      />

      {/* 答案配置テーブル */}
      <div>
        <StudentAnswerTable
          examId={examId}
          students={students}
          files={files}
          modelAnswerCount={finalModelAnswerCount}
          fileOrder={fileOrder}
          isUploading={isUploading}
          onFileOrderChange={setFileOrder}
          onFilesChange={setFiles}
          onUpload={handleUpload}
          observerRef={observerRef}
          mode={mode}
          onReloadData={onUploadComplete}
          existingStudentAnswers={finalExistingAnswers}
        />
      </div>

      {/* PDFパスワードダイアログ */}
      <PasswordDialog
        isOpen={passwordDialog.isOpen}
        onClose={passwordDialog.onCancel}
        onSubmit={passwordDialog.onSubmit}
        fileName={passwordDialog.filename}
        error={passwordDialog.hasError ? "invalid-password" : undefined}
        isLoading={passwordDialog.isLoading}
        isFirstAttempt={!passwordDialog.hasError}
      />
    </div>
  )
}
