"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import type { ImportedFile } from "@/types/pdfTools.types"
import FileDropzone from "./FileDropzone"
import ImportedFileList from "./ImportedFileList"

interface ImportPanelProps {
  importedFiles: ImportedFile[]
  onFilesImported: (files: ImportedFile[]) => void
  onFileRemoved: (fileId: string) => void
  onFileUpdated: (file: ImportedFile) => void
  isProcessing: boolean
}

export default function ImportPanel({
  importedFiles,
  onFilesImported,
  onFileRemoved,
  onFileUpdated,
  isProcessing,
}: ImportPanelProps) {
  return (
    <div className="flex h-full min-w-0 flex-col border-r">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">インポート</h2>
        <p className="text-muted-foreground text-sm">
          PDFファイルをドラッグ&ドロップ
        </p>
      </div>
      <div className="p-4">
        <FileDropzone
          onFilesImported={onFilesImported}
          isProcessing={isProcessing}
        />
      </div>
      <ScrollArea className="flex-1 px-4 pb-4">
        <ImportedFileList
          files={importedFiles}
          onFileRemoved={onFileRemoved}
          onFileUpdated={onFileUpdated}
          isProcessing={isProcessing}
        />
      </ScrollArea>
    </div>
  )
}
