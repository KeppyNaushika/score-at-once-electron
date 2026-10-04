import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import {
  exportPdfAsPngMutation,
  mergePdfsMutation,
  selectPdfSavePathMutation,
  splitPdfMutation,
} from "@/queries/pdfTools"
import type { ImportedFile, OutputSheet } from "@/types/pdfTools.types"

import { composeSheetImage } from "../composeSheetImage"
import { buildPdfPageInputs } from "../pdfPageInputs"

/** 実行中の書き出し種別（ボタンごとのスピナー表示に使う） */
type ExportKind = "merged-pdf" | "split-pdf" | "png"

interface UseOutputExportOptions {
  /** 出力の各ページ（元ページそのままか、N-up の面） */
  outputSheets: OutputSheet[]
  importedFiles: ImportedFile[]
  onProcessingChange: (processing: boolean) => void
}

/**
 * 出力の書き出し（PDF 1ファイル・PDF ページ別・PNG ページ別）。
 *
 * 保存先を選ばせてから書き出し、結果をトーストで知らせる。書き出し中の種別を持ち、
 * 処理中かどうかは親へ伝える（onProcessingChange）
 */
export function useOutputExport({
  outputSheets,
  importedFiles,
  onProcessingChange,
}: UseOutputExportOptions) {
  const [exportKind, setExportKind] = useState<ExportKind | null>(null)

  const buildPageInputs = () => buildPdfPageInputs(outputSheets, importedFiles)

  const selectSavePath = useMutation(selectPdfSavePathMutation())
  const mergePdfs = useMutation(mergePdfsMutation())
  const splitPdf = useMutation(splitPdfMutation())
  const exportAsPng = useMutation(exportPdfAsPngMutation())

  const exportMergedPdf = async () => {
    if (outputSheets.length === 0) {
      toast.error("出力するページがありません")
      return
    }

    // 保存先を選択
    const pathResult = await selectSavePath.mutateAsync({
      type: "pdf",
      defaultName: "output.pdf",
    })

    if (pathResult.canceled) return

    setExportKind("merged-pdf")
    onProcessingChange(true)

    try {
      const outputPath = await mergePdfs.mutateAsync({
        pages: buildPageInputs(),
        outputPath: pathResult.path,
      })
      toast.success(`PDFを保存しました: ${outputPath}`)
    } catch (error) {
      toast.error("PDFを出力できませんでした", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setExportKind(null)
      onProcessingChange(false)
    }
  }

  const exportSplitPdf = async () => {
    if (outputSheets.length === 0) {
      toast.error("出力するページがありません")
      return
    }

    // 保存先フォルダを選択
    const pathResult = await selectSavePath.mutateAsync({
      type: "directory",
    })

    if (pathResult.canceled) return

    setExportKind("split-pdf")
    onProcessingChange(true)

    try {
      const outputPaths = await splitPdf.mutateAsync({
        pages: buildPageInputs(),
        outputDir: pathResult.path,
      })
      toast.success(
        `${outputPaths.length}個のPDFを保存しました: ${pathResult.path}`
      )
    } catch (error) {
      toast.error("PDFをページ別に出力できませんでした", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setExportKind(null)
      onProcessingChange(false)
    }
  }

  const exportPng = async () => {
    if (outputSheets.length === 0) {
      toast.error("出力するページがありません")
      return
    }

    // 保存先フォルダを選択
    const pathResult = await selectSavePath.mutateAsync({
      type: "directory",
    })

    if (pathResult.canceled) return

    setExportKind("png")
    onProcessingChange(true)

    try {
      // サムネイルデータをBufferに変換して送信
      const imageBuffers = await Promise.all(
        outputSheets.map(async (outputSheet, index) => {
          const paddedIndex = String(index + 1).padStart(3, "0")
          const name = `page_${paddedIndex}.png`
          if (outputSheet.kind === "page") {
            // 元ページそのまま: ページ画像を main で回して書き出す
            return {
              buffer: dataUrlToBuffer(outputSheet.thumbnail),
              name,
              rotation: outputSheet.rotation,
            }
          }
          // N-up の面: ページ画像をスロットの中で回してA4キャンバスに合成する
          // （回転は合成に織り込み済みなので、面としては回さない）
          const composed = await composeSheetImage(outputSheet)
          // 合成に失敗（全ページ欠損・描画不可）した場合は先頭ページの画像へフォールバック
          const fallbackThumbnail =
            outputSheet.slots.find((slot) => slot !== null)?.thumbnail ?? ""
          return {
            buffer: dataUrlToBuffer(composed ?? fallbackThumbnail),
            name,
          }
        })
      )

      const outputPaths = await exportAsPng.mutateAsync({
        imageBuffers,
        outputDir: pathResult.path,
      })
      toast.success(`${outputPaths.length}枚のPNGを保存しました`)
    } catch (error) {
      toast.error("PNGを出力できませんでした", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setExportKind(null)
      onProcessingChange(false)
    }
  }

  return { exportKind, exportMergedPdf, exportSplitPdf, exportPng }
}

/** data:image/png;base64,... 形式から Buffer を作る */
function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "")
  return Buffer.from(base64Data, "base64")
}
