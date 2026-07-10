"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"

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
  correctionStatusMap,
  onCorrectionStatusUpdate,
}: StudentAnswerUploadProps) {
  const finalModelAnswerCount = modelAnswerCount
  const finalExistingAnswers = existingStudentAnswers

  // 表・DnD が占有信号として読む最小形（{id, studentId, pageNumber}）に射影する。
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
    // State
    isUploading,
    isConverting,
    files,
    pdfProcessingProgress,
    fileOrder,
    passwordDialog,
    handlePasswordSubmit,
    handlePasswordCancel,
    observerRef,

    // Marker correction
    markerCorrectionEnabled,
    markerCorrectionAvailable,
    markerDiagnostics,
    markerAvailablePages,
    setMarkerCorrectionEnabled,

    // Actions
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

  // 確認モード用の初期化処理
  // existingStudentAnswers の参照が変わったとき（初回・削除/反映後の再読み込み）に
  // files を再構築する。ドラッグ操作では existingStudentAnswers は変化しないため、
  // 配置中の並び替えを巻き込んで再構築することはない。
  const syncedAnswersRef = useRef<typeof finalExistingAnswers | null>(null)
  useEffect(() => {
    if (mode !== "view" || !finalExistingAnswers) return
    if (syncedAnswersRef.current === finalExistingAnswers) return
    syncedAnswersRef.current = finalExistingAnswers

    // 既存答案を配置戦略に基づいて配列構築
    let initialFiles = buildOrderedFileArrayFromStudentAnswers(
      finalExistingAnswers,
      students,
      finalModelAnswerCount,
      fileOrder
    )
    // correctionStatusMapから補正ステータスを注入
    if (correctionStatusMap && correctionStatusMap.size > 0) {
      initialFiles = initialFiles.map((file) => {
        if (file.studentId) {
          const key = `${file.studentId}-${file.pageNumber}`
          const status = correctionStatusMap.get(key)
          if (status) {
            return { ...file, correctionStatus: status }
          }
        }
        return file
      })
    }
    setFiles(initialFiles)
  }, [
    mode,
    finalExistingAnswers,
    students,
    finalModelAnswerCount,
    fileOrder,
    setFiles,
    correctionStatusMap,
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
