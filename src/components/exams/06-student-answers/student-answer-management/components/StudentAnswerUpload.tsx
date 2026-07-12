"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { FileUploadZone } from "@/components/exams/06-student-answers/student-answer-management/components/FileUploadZone"
import { useStudentAnswerUpload } from "@/components/exams/06-student-answers/student-answer-management/hooks/useStudentAnswerUpload"
import type { StudentAnswerUploadProps } from "@/components/exams/06-student-answers/student-answer-management/types"
import { convertAnswerSheetsToFiles } from "@/components/exams/06-student-answers/student-answer-management/utils/convertStudentAnswersToFiles"
import { UploadAnswerTable } from "@/components/exams/06-student-answers/student-answer-table/components/UploadAnswerTable"
import { ViewAnswerTable } from "@/components/exams/06-student-answers/student-answer-table/components/ViewAnswerTable"
import type { AnswerItem } from "@/components/exams/06-student-answers/types"
import { PasswordDialog } from "@/components/ui/password-dialog"

export function StudentAnswerUpload({
  examId,
  students,
  modelAnswerCount,
  onUploadComplete,
  existingStudentAnswers,
  mode = "upload",
  affectedCells,
  onUpdatePendingChanges,
  onUploadFileCountChange,
  correctionStatusMap,
  onCorrectionStatusUpdate,
}: StudentAnswerUploadProps) {
  const finalModelAnswerCount = modelAnswerCount
  const finalExistingAnswers = existingStudentAnswers

  // 表・DnD が占有信号／差分基準として読む最小形（{id, studentId, pageNumber}）に射影する。
  // DB答案は Prisma 型のまま持ち回り、テーブル境界でだけ座標へ落とす。
  const existingAnswerOccupancy = useMemo(
    () =>
      finalExistingAnswers?.map((answerSheet) => ({
        id: answerSheet.id,
        studentId: answerSheet.studentId,
        pageNumber: answerSheet.examPage.pageNumber,
      })),
    [finalExistingAnswers]
  )

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

  // 確認モード用の答案配列（DB答案の投射 AnswerItem[]）。孤立答案も含めて全件持つ。
  // existingStudentAnswers の参照が変わったとき（初回・削除/反映後の再読み込み）にのみ
  // 再構築する。ドラッグ操作では参照が変わらないため配置中の並びを巻き込まない。
  const [viewFiles, setViewFiles] = useState<AnswerItem[]>([])
  const syncedAnswersRef = useRef<typeof finalExistingAnswers | null>(null)
  useEffect(() => {
    if (mode !== "view" || !finalExistingAnswers) return
    if (syncedAnswersRef.current === finalExistingAnswers) return
    syncedAnswersRef.current = finalExistingAnswers

    let initialFiles = convertAnswerSheetsToFiles(finalExistingAnswers)
    // correctionStatusMap から補正ステータスを注入
    if (correctionStatusMap && correctionStatusMap.size > 0) {
      initialFiles = initialFiles.map((item) => {
        if (item.studentId) {
          const key = `${item.studentId}-${item.pageNumber}`
          const status = correctionStatusMap.get(key)
          if (status) {
            return { ...item, correctionStatus: status }
          }
        }
        return item
      })
    }
    setViewFiles(initialFiles)
  }, [mode, finalExistingAnswers, correctionStatusMap])

  // ナビゲーションガード用: アップロード待ちファイル数の通知
  useEffect(() => {
    if (mode === "upload" && onUploadFileCountChange) {
      onUploadFileCountChange(files.length)
    }
  }, [mode, files.length, onUploadFileCountChange])

  // 表示モードでは既存の答案をテーブル表示
  if (mode === "view" && finalExistingAnswers) {
    return (
      <ViewAnswerTable
        examId={examId}
        students={students}
        files={viewFiles}
        modelAnswerCount={finalModelAnswerCount}
        onFilesChange={setViewFiles}
        onReloadData={onUploadComplete}
        affectedCells={affectedCells}
        onUpdatePendingChanges={onUpdatePendingChanges}
        existingStudentAnswers={existingAnswerOccupancy}
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
        <UploadAnswerTable
          examId={examId}
          students={students}
          files={files}
          modelAnswerCount={finalModelAnswerCount}
          fileOrder={fileOrder}
          isUploading={isUploading}
          onFileOrderChange={setFileOrder}
          onFilesChange={setFiles}
          onUpload={handleUpload}
          onReloadData={onUploadComplete}
          existingStudentAnswers={existingAnswerOccupancy}
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
