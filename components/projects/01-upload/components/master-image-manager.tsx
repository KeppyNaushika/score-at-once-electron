"use client"

import { PasswordDialog } from "@/components/ui/password-dialog"
import type { MasterImageManagerProps } from "../types"
import { useMasterImages } from "../hooks/use-master-images"
import { FileUploadDropzone } from "./file-upload-dropzone"
import { MasterImageGallery } from "./master-image-gallery"

/**
 * MasterImageManager - 模範解答画像管理のメインコンポーネント
 * 
 * 機能:
 * - ファイルアップロード機能
 * - 模範解答画像一覧表示
 * - 画像の削除・順序変更
 * - パスワード保護PDFの処理
 * - 画像URL管理
 * 
 * @param projectId - プロジェクトID
 * @param initialMasterImages - 初期画像データ
 * @param onMasterImagesChange - 画像データ変更時のコールバック関数
 * @returns 模範解答画像管理コンポーネント
 */
export function MasterImageManager({
  projectId,
  initialMasterImages,
  onMasterImagesChange,
}: MasterImageManagerProps) {
  const {
    images,
    imageUrls,
    isUploading,
    uploadProgress,
    isDeleting,
    isMoving,
    passwordDialog,
    uploadImages,
    deleteImage,
    moveImage,
    handlePasswordSubmit,
    handlePasswordCancel,
  } = useMasterImages(projectId, initialMasterImages, onMasterImagesChange)

  return (
    <div className="space-y-6">
      {/* ファイルアップロードエリア */}
      <FileUploadDropzone
        onFilesSelected={uploadImages}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        accept=".pdf,.png,.jpg,.jpeg"
        maxFileSize={50 * 1024 * 1024} // 50MB
      />

      {/* 画像一覧表示 */}
      <MasterImageGallery
        images={images}
        imageUrls={imageUrls}
        isDeleting={isDeleting}
        isMoving={isMoving}
        onDeleteImage={deleteImage}
        onMoveImage={moveImage}
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