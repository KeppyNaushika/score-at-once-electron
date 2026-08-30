"use client"

import type { ImportedFile } from "@/types/pdfTools.types"

import ImportedFileItem from "./ImportedFileItem"

interface ImportedFileListProps {
  files: ImportedFile[]
  excludedPages: Set<string>
  onFileRemoved: (fileId: string) => void
  onFileUpdated: (file: ImportedFile) => void
  onResetExcludedPages: (fileId?: string) => void
  isProcessing: boolean
  previewColumns: number
}

export default function ImportedFileList({
  files,
  excludedPages,
  onFileRemoved,
  onFileUpdated,
  onResetExcludedPages,
  isProcessing,
  previewColumns,
}: ImportedFileListProps) {
  if (files.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
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
          excludedPages={excludedPages}
          onRemove={() => onFileRemoved(file.id)}
          onUpdate={onFileUpdated}
          onResetExcluded={() => onResetExcludedPages(file.id)}
          isProcessing={isProcessing}
          previewColumns={previewColumns}
        />
      ))}
    </div>
  )
}
