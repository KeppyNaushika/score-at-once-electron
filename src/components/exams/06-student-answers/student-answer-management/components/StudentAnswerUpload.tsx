"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { FileUploadZone } from "@/components/exams/06-student-answers/student-answer-management/components/FileUploadZone"
import { useStudentAnswerUpload } from "@/components/exams/06-student-answers/student-answer-management/hooks/useStudentAnswerUpload"
import type { StudentAnswerUploadProps } from "@/components/exams/06-student-answers/student-answer-management/types"
import { UploadAnswerTable } from "@/components/exams/06-student-answers/student-answer-table/components/UploadAnswerTable"
import { ViewAnswerTable } from "@/components/exams/06-student-answers/student-answer-table/components/ViewAnswerTable"
import { PasswordDialog } from "@/components/ui/password-dialog"
import type { PlacedAnswerImage } from "@/types/prismaExtensions"

export function StudentAnswerUpload({
  examId,
  students,
  examPages,
  onUploadComplete,
  mode = "upload",
  affectedCells,
  onUpdatePendingChanges,
  onUploadFileCountChange,
  correctionStatusMap,
  onCorrectionStatusUpdate,
}: StudentAnswerUploadProps) {
  // 配置済み答案は列（ExamPage 実体）の子から取り出す。射影せず実体（PlacedAnswerImage）のまま持つ。
  const placedAnswers = useMemo<PlacedAnswerImage[]>(
    () => examPages.flatMap((examPage) => examPage.studentAnswerImages),
    [examPages]
  )

  // view 方式B の差分基準（DB baseline）／upload の占有信号は、DB答案の実体
  // （placedAnswers = PlacedAnswerImage[]）をそのまま渡す（id 3つ組へ射影しない）。
  // 受け手は AnswerImageIdentity 契約で id を読むだけ。

  const {
    isUploading,
    isConverting,
    files,
    pdfProcessingProgress,
    fileOrder,
    passwordDialog,
    handlePasswordSubmit,
    handlePasswordCancel,
    markerCorrectionEnabled,
    markerCorrectionAvailable,
    markerDiagnostics,
    markerAvailablePages,
    setMarkerCorrectionEnabled,
    setFiles,
    setFileOrder,
    handleDrop,
    handleUpload,
  } = useStudentAnswerUpload(
    examId,
    onUploadComplete,
    onCorrectionStatusUpdate,
    mode
  )

  // 確認モード用の答案配列（保存済み実体 PlacedAnswerImage[]）。孤立答案も含めて全件持つ。
  // 供給（examPages）の参照が変わったとき（初回・削除/反映後の再読み込み）にのみ再構築する。
  // ドラッグ操作では examPages の参照が変わらないため配置中の並びを巻き込まない。
  const [viewFiles, setViewFiles] = useState<PlacedAnswerImage[]>([])
  const syncedExamPagesRef = useRef<typeof examPages | null>(null)
  useEffect(() => {
    if (mode !== "view") return
    if (syncedExamPagesRef.current === examPages) return
    syncedExamPagesRef.current = examPages
    setViewFiles(placedAnswers)
  }, [mode, examPages, placedAnswers])

  // ナビゲーションガード用: アップロード待ちファイル数の通知
  useEffect(() => {
    if (mode === "upload" && onUploadFileCountChange) {
      onUploadFileCountChange(files.length)
    }
  }, [mode, files.length, onUploadFileCountChange])

  // 表示モードでは既存の答案をテーブル表示
  if (mode === "view") {
    return (
      <ViewAnswerTable
        examId={examId}
        students={students}
        examPages={examPages}
        files={viewFiles}
        onFilesChange={setViewFiles}
        onReloadData={onUploadComplete}
        affectedCells={affectedCells}
        onUpdatePendingChanges={onUpdatePendingChanges}
        existingAnswers={placedAnswers}
        correctionStatusMap={correctionStatusMap}
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
        modelAnswerCount={examPages.length}
        pdfProcessingProgress={pdfProcessingProgress}
      />

      {/* 答案配置テーブル */}
      <div>
        <UploadAnswerTable
          examId={examId}
          students={students}
          examPages={examPages}
          files={files}
          fileOrder={fileOrder}
          isUploading={isUploading}
          onFileOrderChange={setFileOrder}
          onFilesChange={setFiles}
          onUpload={handleUpload}
          onReloadData={onUploadComplete}
          existingAnswers={placedAnswers}
          markerCorrectionEnabled={markerCorrectionEnabled}
          markerCorrectionAvailable={markerCorrectionAvailable}
          markerDiagnostics={markerDiagnostics}
          markerAvailablePages={markerAvailablePages}
          onMarkerCorrectionChange={setMarkerCorrectionEnabled}
        />
      </div>

      {/* PDFパスワードダイアログ */}
      <PasswordDialog
        isOpen={passwordDialog.isOpen}
        onClose={handlePasswordCancel}
        onSubmit={handlePasswordSubmit}
        fileName={passwordDialog.fileName}
        error={passwordDialog.hasError ? "invalid-password" : undefined}
        isLoading={passwordDialog.isLoading}
        isFirstAttempt={!passwordDialog.hasError}
      />
    </div>
  )
}
