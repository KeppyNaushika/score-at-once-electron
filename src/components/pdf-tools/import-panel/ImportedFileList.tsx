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
}

export default function ImportedFileList({
  files,
  excludedPages,
  onFileRemoved,
  onFileUpdated,
  onResetExcludedPages,
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
          excludedPages={excludedPages}
          onRemove={() => onFileRemoved(file.id)}
          onUpdate={onFileUpdated}
          onResetExcluded={() => onResetExcludedPages(file.id)}
          isProcessing={isProcessing}
        />
      ))}
    </div>
  )
}
