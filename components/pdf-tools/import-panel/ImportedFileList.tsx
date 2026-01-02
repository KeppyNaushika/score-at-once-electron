"use client"

import type { ImportedFile } from "@/types/pdfTools.types"
import ImportedFileItem from "./ImportedFileItem"

interface ImportedFileListProps {
  files: ImportedFile[]
  onFileRemoved: (fileId: string) => void
  onFileUpdated: (file: ImportedFile) => void
  isProcessing: boolean
}

export default function ImportedFileList({
  files,
  onFileRemoved,
  onFileUpdated,
  isProcessing,
}: ImportedFileListProps) {
  if (files.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        ファイルがありません
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {files.map((file) => (
        <ImportedFileItem
          key={file.id}
          file={file}
          onRemove={() => onFileRemoved(file.id)}
          onUpdate={onFileUpdated}
          isProcessing={isProcessing}
        />
      ))}
    </div>
  )
}
