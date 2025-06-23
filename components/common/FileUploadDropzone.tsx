"use client"

import { cn } from "@/lib/utils"
import { Loader2, UploadCloud } from "lucide-react"
import React from "react"
import { useDropzone } from "react-dropzone"

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

const FileUploadDropzone = React.memo(
  ({
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
    additionalInfo,
  }: FileUploadDropzoneProps) => {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop: onFilesSelected,
      accept,
      multiple,
      disabled: disabled || isUploading,
    })

    return (
      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          (disabled || isUploading) && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <input {...getInputProps()} disabled={disabled || isUploading} />
        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
          {isUploading ? (
            <div>
              <Loader2 className="text-primary mx-auto h-10 w-10 animate-spin" />
              <h3 className="mt-4 text-lg font-semibold">アップロード中...</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                PDFの変換処理を含む場合、時間がかかることがあります
              </p>
            </div>
          ) : (
            <>
              <UploadCloud className="text-muted-foreground mx-auto h-10 w-10" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="text-muted-foreground mt-2 mb-4 text-sm">
                {description}
              </p>
              {additionalInfo && (
                <p className="text-muted-foreground text-xs">
                  {additionalInfo}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    )
  },
)

FileUploadDropzone.displayName = "FileUploadDropzone"

export default FileUploadDropzone
