"use client"

import { FileImage, FileText, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { computeNUpLayout } from "@/lib/pdf-tools/nUpLayout"
import type {
  ImportedFile,
  NUpLayout,
  OutputPage,
} from "@/types/pdfTools.types"

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
          // 2-in-1結合ページはページ画像をA4キャンバスに合成する
          // （合成しないと1ページ目のサムネイルだけが書き出される）
          let dataUrl = page.thumbnail
          if (
            page.isNUpCombined &&
            page.combinedPages &&
            page.combinedPages.length > 0
          ) {
            const file = importedFiles.find(
              (importedFile) => importedFile.id === page.sourceFileId
            )
            if (file) {
              // combinedPages順（=スロット順）にサムネイルを並べる。
              // 欠損ページは undefined のまま渡し、空スロットとして扱う
              const thumbnails = page.combinedPages.map(
                (pageNumber) => file.thumbnails[pageNumber - 1]
              )
              const composed = await composeNUpImage(
                thumbnails,
                page.nUpLayout || "2x1"
              )
              // 合成に失敗（全ページ欠損・描画不可）した場合は元サムネイルへフォールバック
              if (composed) dataUrl = composed
            }
          }

          // data:image/png;base64,... 形式からBufferを作成
          const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "")
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
      <div className="text-sm text-muted-foreground">
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

// A4縦サイズ (ポイント単位) を基準にした合成キャンバスの寸法（2倍解像度）
const A4_PORTRAIT_BASE = {
  width: Math.round(595.28 * 2),
  height: Math.round(841.89 * 2),
}

/** data URL から HTMLImageElement を読み込む（失敗時は null） */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

/**
 * 2-in-1のページ画像をA4比率のキャンバスに合成してPNGのdata URLを返す。
 * スロット配置はPDF側の addNUpPage（pdfMerger.ts）と computeNUpLayout を共有する。
 *
 * @param thumbnails スロット順（combinedPages順）の data URL。欠損は undefined 可
 * @returns 合成画像の data URL。描画対象が1枚も無ければ null
 */
async function composeNUpImage(
  thumbnails: (string | undefined)[],
  layout: NUpLayout
): Promise<string | null> {
  // スロット順を保ったまま読み込む（欠損・デコード失敗は null＝空スロット）
  const images = await Promise.all(
    thumbnails.map((thumbnail) =>
      thumbnail ? loadImage(thumbnail) : Promise.resolve(null)
    )
  )
  if (images.every((image) => image === null)) return null

  const { pageWidth, pageHeight, placements } = computeNUpLayout(
    layout,
    images.map((image) =>
      image ? { width: image.width, height: image.height } : null
    ),
    A4_PORTRAIT_BASE
  )

  const canvas = document.createElement("canvas")
  canvas.width = pageWidth
  canvas.height = pageHeight
  const context = canvas.getContext("2d")
  if (!context) return null
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, pageWidth, pageHeight)

  placements.forEach((placement, index) => {
    const image = images[index]
    if (!placement || !image) return
    // computeNUpLayout も canvas も左上原点なので yTop をそのまま使える
    context.drawImage(
      image,
      placement.x,
      placement.yTop,
      placement.width,
      placement.height
    )
  })

  return canvas.toDataURL("image/png")
}
