"use client"

import React from "react"
import { useDropzone } from "react-dropzone"
import { UploadCloud, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileUploadDropzoneProps {
  onFilesSelected: (files: File[]) => void
  accept?: Record<string, string[]>
  multiple?: boolean
  disabled?: boolean
  isUploading?: boolean
  className?: string
  title?: string
  description?: string
  additionalInfo?: string
}

const FileUploadDropzone = React.memo(({
  onFilesSelected,
  accept = {
    "image/*": [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff"],
  },
  multiple = true,
  disabled = false,
  isUploading = false,
  className,
  title = "ファイルをドロップまたはクリックして選択",
  description = "画像ファイル (PNG, JPG) をアップロードできます",
  additionalInfo
}: FileUploadDropzoneProps) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onFilesSelected,
    accept,
    multiple,
    disabled: disabled || isUploading
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50",
        (disabled || isUploading) && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <input {...getInputProps()} disabled={disabled || isUploading} />
      <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
        {isUploading ? (
          <div>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h3 className="mt-4 text-lg font-semibold">アップロード中...</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              PDFの変換処理を含む場合、時間がかかることがあります
            </p>
          </div>
        ) : (
          <>
            <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mb-4 mt-2 text-sm text-muted-foreground">
              {description}
            </p>
            {additionalInfo && (
              <p className="text-xs text-muted-foreground">
                {additionalInfo}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
})

FileUploadDropzone.displayName = "FileUploadDropzone"

export default FileUploadDropzone