"use client"

import { PasswordDialog } from "@/components/ui/password-dialog"
import { useMasterAnswers } from "../hooks/useMasterAnswers"
import type { MasterAnswerManagerProps } from "@/components/projects/01-upload/types"
import { FileUploadDropzone } from "./FileUploadDropzone"
import { MasterAnswerGallery } from "./MasterAnswerGallery"

/**
 * MasterAnswerManager - 模範解答画像管理のメインコンポーネント
 *
 * 機能:
 * - ファイルアップロード機能
 * - 模範解答画像一覧表示
 * - 画像の削除・順序変更
 * - パスワード保護PDFの処理
 * - 画像URL管理
 *
 * @param projectId - プロジェクトID
 * @param initialMasterAnswers - 初期画像データ
 * @param onMasterAnswersChange - 画像データ変更時のコールバック関数
 * @returns 模範解答画像管理コンポーネント
 */
export function MasterAnswerManager({
  projectId,
  initialMasterAnswers,
  onMasterAnswersChange,
}: MasterAnswerManagerProps) {
  const {
    answers,
    imageUrls,
    isUploading,
    uploadProgress,
    isDeleting,
    isMoving,
    passwordDialog,
    uploadAnswers,
    deleteAnswer,
    moveAnswer,
    handlePasswordSubmit,
    handlePasswordCancel,
  } = useMasterAnswers(projectId, initialMasterAnswers, onMasterAnswersChange)

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
        isMoving={isMoving}
        onDeleteAnswer={deleteAnswer}
        onMoveAnswer={moveAnswer}
      />

      {/* パスワード入力ダイアログ */}
      <PasswordDialog
        isOpen={passwordDialog.isOpen}
        onClose={handlePasswordCancel}
        onSubmit={handlePasswordSubmit}
        fileName={passwordDialog.fileName || ""}
        error={
          passwordDialog.hasError ? "パスワードが正しくありません" : undefined
        }
        isLoading={passwordDialog.isLoading}
        isFirstAttempt={passwordDialog.attempts === 0}
      />
    </div>
  )
}
