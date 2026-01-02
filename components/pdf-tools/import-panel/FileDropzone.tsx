"use client"

import { cn } from "@/lib/utils"
import type { ImportedFile } from "@/types/pdfTools.types"
import { FileUp, Loader2 } from "lucide-react"
import { useCallback, useState, type DragEvent } from "react"
import { toast } from "sonner"
import { useImportedFiles } from "./hooks/useImportedFiles"

interface FileDropzoneProps {
  onFilesImported: (files: ImportedFile[]) => void
  isProcessing: boolean
}

export default function FileDropzone({
  onFilesImported,
  isProcessing,
}: FileDropzoneProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const { processFiles, processFilePaths } = useImportedFiles()

  // Electronダイアログでファイル選択
  const handleClick = useCallback(async () => {
    if (isProcessing || isLoading) return

    try {
      const result = await window.electronAPI.pdfTools.selectFiles()
      if (result.canceled || !result.filePaths?.length) return

      setIsLoading(true)
      const processedFiles = await processFilePaths(result.filePaths)
      if (processedFiles.length > 0) {
        onFilesImported(processedFiles)
        toast.success(`${processedFiles.length}件のファイルを追加しました`)
      }
    } catch (error) {
      console.error("File selection error:", error)
      toast.error("ファイルの選択中にエラーが発生しました")
    } finally {
      setIsLoading(false)
    }
  }, [isProcessing, isLoading, onFilesImported, processFilePaths])

  // ドラッグ&ドロップでファイル追加
  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      if (isProcessing || isLoading) return

      const files = Array.from(e.dataTransfer.files).filter(
        (file) => file.type === "application/pdf"
      )

      if (files.length === 0) {
        toast.error("PDFファイルのみ対応しています")
        return
      }

      setIsLoading(true)
      try {
        // Electron環境ではFile.pathからパスを取得できる
        const processedFiles = await processFiles(files)
        if (processedFiles.length > 0) {
          onFilesImported(processedFiles)
          toast.success(`${processedFiles.length}件のファイルを追加しました`)
        }
      } catch (error) {
        console.error("File drop error:", error)
        toast.error("ファイルの処理中にエラーが発生しました")
      } finally {
        setIsLoading(false)
      }
    },
    [isProcessing, isLoading, onFilesImported, processFiles]
  )

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
        "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
        isDragOver && "border-primary bg-primary/10",
        (isProcessing || isLoading) && "cursor-not-allowed opacity-50"
      )}
    >
      {isLoading ? (
        <>
          <Loader2 className="text-muted-foreground mb-2 h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">処理中...</p>
        </>
      ) : (
        <>
          <FileUp className="text-muted-foreground mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-center text-sm">
            ドラッグ&ドロップ または クリックしてPDFファイルを選択
          </p>
        </>
      )}
    </div>
  )
}
