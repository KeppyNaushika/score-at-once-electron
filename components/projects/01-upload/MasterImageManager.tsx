"use client"

import FileUploadDropzone from "@/components/common/FileUploadDropzone"
import MasterImageGallery from "@/components/projects/01-upload/MasterImageGallery"
import { PasswordDialog } from "@/components/ui/password-dialog"
import { useMasterImages } from "@/hooks/useMasterImages"
import { Prisma } from "@prisma/client"

type MasterImage = Prisma.PageImageGetPayload<{ include: { projectPage: true } }>

interface MasterImageManagerProps {
  projectId: string
  initialMasterImages: MasterImage[]
  onMasterImagesChange: (images: MasterImage[]) => void
}

export default function MasterImageManager({
  projectId,
  initialMasterImages,
  onMasterImagesChange,
}: MasterImageManagerProps) {
  const {
    images,
    imageUrls,
    isUploading,
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
      <FileUploadDropzone
        onFilesSelected={uploadImages}
        accept={{
          "image/*": [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff"],
          "application/pdf": [".pdf"],
        }}
        multiple={true}
        isUploading={isUploading}
        title="ファイルをドロップまたはクリックして選択"
        description="PDF または画像ファイル (PNG, JPG) をアップロードできます"
        additionalInfo="PDF の場合、各ページが自動的に画像として分割されます"
      />

      <MasterImageGallery
        images={images}
        imageUrls={imageUrls}
        isDeleting={isDeleting}
        isMoving={isMoving}
        onDeleteImage={deleteImage}
        onMoveImage={moveImage}
      />

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
