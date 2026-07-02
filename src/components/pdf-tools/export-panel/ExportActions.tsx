"use client"

import { FileImage, FileText, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { ImportedFile, OutputPage } from "@/types/pdfTools.types"

interface ExportActionsProps {
  outputPages: OutputPage[]
  importedFiles: ImportedFile[]
  isProcessing: boolean
  onProcessingChange: (processing: boolean) => void
}

export default function ExportActions({
  outputPages,
  importedFiles,
  isProcessing,
  onProcessingChange,
}: ExportActionsProps) {
  const [exportType, setExportType] = useState<"pdf" | "png" | null>(null)

  const handleExportPdf = async () => {
    if (outputPages.length === 0) {
      toast.error("出力するページがありません")
      return
    }

    // 保存先を選択
    const pathResult = await window.electronAPI.pdfTools.selectSavePath({
      type: "pdf",
      defaultName: "output.pdf",
    })

    if (pathResult.canceled || !pathResult.path) {
      return
    }

    setExportType("pdf")
    onProcessingChange(true)

    try {
      // OutputPagesからMergePageInputを作成
      const pages = outputPages.map((page) => {
        const file = importedFiles.find(
          (importedFile) => importedFile.id === page.sourceFileId
        )
        console.log("Creating page input:", {
          fileId: page.sourceFileId,
          fileName: file?.name,
          filePath: file?.path,
          pageNumber: page.sourcePageNumber,
          isNUpCombined: page.isNUpCombined,
          combinedPages: page.combinedPages,
          nUpLayout: page.nUpLayout,
        })
        return {
          filePath: file?.path || "",
          pageNumber: page.sourcePageNumber,
          rotation: page.rotation,
          // 2-in-1情報
          isNUpCombined: page.isNUpCombined,
          combinedPages: page.combinedPages,
          nUpLayout: page.nUpLayout,
        }
      })

      const result = await window.electronAPI.pdfTools.mergePdfs({
        pages,
        outputPath: pathResult.path,
      })

      if (result.success) {
        toast.success(`PDFを保存しました: ${pathResult.path}`)
      } else {
        toast.error(`PDF出力エラー: ${result.error}`)
      }
    } catch (error) {
      console.error("PDF export error:", error)
      toast.error("PDF出力中にエラーが発生しました")
    } finally {
      setExportType(null)
      onProcessingChange(false)
    }
  }

  const handleExportPng = async () => {
    if (outputPages.length === 0) {
      toast.error("出力するページがありません")
      return
    }

    // 保存先フォルダを選択
    const pathResult = await window.electronAPI.pdfTools.selectSavePath({
      type: "directory",
    })

    if (pathResult.canceled || !pathResult.path) {
      return
    }

    setExportType("png")
    onProcessingChange(true)

    try {
      // サムネイルデータをBufferに変換して送信
      const imageBuffers = await Promise.all(
        outputPages.map(async (page, index) => {
          // data:image/png;base64,... 形式からBufferを作成
          const base64Data = page.thumbnail.replace(
            /^data:image\/\w+;base64,/,
            ""
          )
          const buffer = Buffer.from(base64Data, "base64")
          const paddedIndex = String(index + 1).padStart(3, "0")
          return {
            buffer,
            name: `page_${paddedIndex}.png`,
            rotation: page.rotation,
          }
        })
      )

      const result = await window.electronAPI.pdfTools.exportAsPng({
        imageBuffers,
        outputDir: pathResult.path,
      })

      if (result.success) {
        toast.success(`${outputPages.length}枚のPNGを保存しました`)
      } else {
        toast.error(`PNG出力エラー: ${result.error}`)
      }
    } catch (error) {
      console.error("PNG export error:", error)
      toast.error("PNG出力中にエラーが発生しました")
    } finally {
      setExportType(null)
      onProcessingChange(false)
    }
  }

  const pageCount = outputPages.length
  const fileCount = importedFiles.length

  return (
    <div className="space-y-3">
      <div className="text-muted-foreground text-sm">
        {fileCount}ファイル / {pageCount}ページを出力
      </div>
      <div className="flex gap-2">
        <Button
          onClick={handleExportPdf}
          disabled={isProcessing || pageCount === 0}
          className="flex-1"
        >
          {exportType === "pdf" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileText className="mr-2 h-4 w-4" />
          )}
          PDF出力
        </Button>
        <Button
          variant="outline"
          onClick={handleExportPng}
          disabled={isProcessing || pageCount === 0}
          className="flex-1"
        >
          {exportType === "png" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileImage className="mr-2 h-4 w-4" />
          )}
          PNG出力
        </Button>
      </div>
    </div>
  )
}
