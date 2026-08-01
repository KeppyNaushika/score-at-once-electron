"use client"

import type { MasterAnswerManagerProps } from "@/components/exams/01-upload/types"
import { PasswordDialog } from "@/components/ui/password-dialog"

import { useMasterAnswers } from "../hooks/useMasterAnswers"
import { FileUploadDropzone } from "./FileUploadDropzone"
import { MasterAnswerGallery } from "./MasterAnswerGallery"

/**
 * MasterAnswerManager - 模範解答画像管理のメインコンポーネント
 *
 * 機能:
 * - ファイルアップロード機能
 * - 模範解答画像一覧表示
 * - 模範解答画像の差し替え
 * - ページの削除・順序変更
 * - パスワード保護PDFの処理
 * - 画像URL管理
 *
 * @param examId - 試験ID
 * @param initialMasterAnswers - 初期画像データ
 * @param onMasterAnswersChange - 画像データ変更時のコールバック関数
 * @returns 模範解答画像管理コンポーネント
 */
export function MasterAnswerManager({
  examId,
  initialMasterAnswers,
  onMasterAnswersChange,
}: MasterAnswerManagerProps) {
  const {
    answers,
    imageUrls,
    isUploading,
    uploadProgress,
    isDeleting,
    isReplacing,
    isMoving,
    passwordDialog,
    uploadAnswers,
    replaceAnswerImage,
    deleteAnswer,
    moveAnswer,
    updatePageSize,
    handlePasswordSubmit,
    handlePasswordCancel,
  } = useMasterAnswers(examId, initialMasterAnswers, onMasterAnswersChange)

  return (
    <div className="space-y-6">
      {/* ファイルアップロードエリア */}
      <FileUploadDropzone
        onFilesSelected={uploadAnswers}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        accept=".pdf,.png,.jpg,.jpeg"
        maxFileSize={50 * 1024 * 1024} // 50MB
      />

      {/* 画像一覧表示 */}
      <MasterAnswerGallery
        answers={answers}
        imageUrls={imageUrls}
        isDeleting={isDeleting}
        isReplacing={isReplacing}
        isMoving={isMoving}
        onDeleteAnswer={deleteAnswer}
        onReplaceAnswer={replaceAnswerImage}
        onMoveAnswer={moveAnswer}
        onPageSizeChange={updatePageSize}
      />

      {/* パスワード入力ダイアログ */}
      {passwordDialog.isOpen && (
        <PasswordDialog
          isOpen={passwordDialog.isOpen}
          onClose={handlePasswordCancel}
          onSubmit={handlePasswordSubmit}
          fileName={passwordDialog.fileName}
          error={
            passwordDialog.hasError ? "パスワードが正しくありません" : undefined
          }
          isLoading={passwordDialog.isLoading}
          isFirstAttempt={!passwordDialog.hasError}
        />
      )}
    </div>
  )
}
