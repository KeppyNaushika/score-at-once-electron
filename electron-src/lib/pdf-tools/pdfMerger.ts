/**
 * PDF結合ユーティリティ
 * 複数PDFから選択ページを1つのPDFに結合
 */
import * as fs from "fs"
import { degrees, PDFDocument } from "pdf-lib"

import type { PdfPageInput } from "@/types/pdfTools.types"

import { addNUpSheet } from "./nUpSheetPage"
import { loadSourcePage, type SourcePdfCache } from "./sourcePdfPages"

/**
 * ページ入力を解決して対象PDFへ1ページ追加する。
 *
 * 結合（1ファイルへ全ページ）とページ別書き出し（1ページ1ファイル）で
 * 同じ変換（N-up の面・回転）を共有するための単位。
 *
 * @returns 追加できた場合 true。元ファイルやページ番号が無効で飛ばした場合 false
 */
export async function appendPageToPdf(
  targetPdf: PDFDocument,
  page: PdfPageInput,
  pdfCache: SourcePdfCache
): Promise<boolean> {
  if (page.kind === "sheet") {
    return await addNUpSheet(targetPdf, page, pdfCache)
  }

  // 元ページそのまま: 単一ページをコピー（注釈なども元のまま残る）
  const loaded = await loadSourcePage(page, pdfCache)
  if (!loaded) return false

  const [copiedPage] = await targetPdf.copyPages(loaded.sourcePdf, [
    page.pageNumber - 1,
  ])

  // 回転を適用
  if (page.rotation) {
    const currentRotation = copiedPage.getRotation().angle
    copiedPage.setRotation(degrees(currentRotation + page.rotation))
  }

  targetPdf.addPage(copiedPage)
  return true
}

/**
 * 複数のPDFからページを結合して新しいPDFを作成
 */
export async function mergePdfs(
  pages: PdfPageInput[],
  outputPath: string
): Promise<string> {
  const mergedPdf = await PDFDocument.create()
  const pdfCache: SourcePdfCache = new Map()

  for (const page of pages) {
    await appendPageToPdf(mergedPdf, page, pdfCache)
  }

  // PDFを保存
  const pdfBytes = await mergedPdf.save()
  fs.writeFileSync(outputPath, pdfBytes)

  return outputPath
}
