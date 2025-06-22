"use client"

import { Prisma } from "@prisma/client"
import FileUploadDropzone from "@/components/common/FileUploadDropzone"
import MasterImageGallery from "./MasterImageGallery"
import { useMasterImages } from "@/hooks/useMasterImages"

interface MasterImageManagerProps {
  projectId: string
  initialMasterImages: Prisma.MasterImageGetPayload<{}>[]
  onMasterImagesChange: (images: Prisma.MasterImageGetPayload<{}>[]) => void
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
    uploadImages,
    deleteImage,
    moveImage
  } = useMasterImages(projectId, initialMasterImages, onMasterImagesChange)

  return (
    <div className="space-y-6">
      <FileUploadDropzone
        onFilesSelected={uploadImages}
        accept={{
          "image/*": [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff"],
          "application/pdf": [".pdf"]
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
    </div>
  )
}