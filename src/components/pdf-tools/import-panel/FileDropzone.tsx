"use client"

import { useMutation } from "@tanstack/react-query"
import { FileUp, Loader2 } from "lucide-react"
import { type DragEvent, useCallback, useState } from "react"
import { toast } from "sonner"

import { PasswordDialog } from "@/components/ui/password-dialog"
import { cn } from "@/lib/utils"
import { selectPdfFilesMutation } from "@/queries/pdfTools"
import type { ImportedFile } from "@/types/pdfTools.types"

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
  const {
    processFiles,
    processFilePaths,
    passwordDialog,
    handlePasswordSubmit,
    handlePasswordCancel,
  } = useImportedFiles()
  const selectPdfFiles = useMutation(selectPdfFilesMutation())

  // Electronダイアログでファイル選択
  const handleClick = useCallback(async () => {
    if (isProcessing || isLoading) return

    try {
      const result = await selectPdfFiles.mutateAsync()
      if (result.canceled || result.filePaths.length === 0) return

      setIsLoading(true)
      const processedFiles = await processFilePaths(result.filePaths)
      if (processedFiles.length > 0) {
        onFilesImported(processedFiles)
        toast.success(`${processedFiles.length}件のファイルを追加しました`)
      }
    } catch (error) {
      toast.error("ファイルを選択できませんでした", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setIsLoading(false)
    }
  }, [
    isProcessing,
    isLoading,
    onFilesImported,
    processFilePaths,
    selectPdfFiles,
  ])

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
    <>
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
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">処理中...</p>
          </>
        ) : (
          <>
            <FileUp className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">
              ドラッグ&ドロップ または クリックしてPDFファイルを選択
            </p>
          </>
        )}
      </div>

      {/* パスワード保護PDFの入力ダイアログ */}
      {passwordDialog.isOpen && (
        <PasswordDialog
          isOpen={passwordDialog.isOpen}
          onClose={handlePasswordCancel}
          onSubmit={handlePasswordSubmit}
          fileName={passwordDialog.fileName}
          error={
            passwordDialog.hasError ? "パスワードが正しくありません" : undefined
          }
          isLoading={passwordDialog.isLoading}
          isFirstAttempt={!passwordDialog.hasError}
        />
      )}
    </>
  )
}
