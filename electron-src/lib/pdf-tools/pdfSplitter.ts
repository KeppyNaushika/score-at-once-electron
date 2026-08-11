/**
 * PDF分割ユーティリティ
 * 出力ページを1ページ1ファイルのPDFとして書き出す
 */
import * as fs from "fs"
import * as path from "path"
import { PDFDocument } from "pdf-lib"

import type { PdfPageInput } from "@/types/pdfTools.types"

import { appendPageToPdf, type SourcePdfCache } from "./pdfMerger"

/**
 * 出力ページを1ページ1ファイルのPDFへ分割して書き出す。
 *
 * 結合（mergePdfs）と同じページ入力を受け取るので、並び替え・除外・回転・2-in-1
 * といった出力プレビューの編集内容がそのまま反映される。
 *
 * @param pages 書き出す順のページ入力。1件が1ファイルになる
 * @param outputDir 出力先ディレクトリ
 * @param prefix 出力ファイル名の接頭辞（既定は "page"）
 */
export async function splitPdf(
  pages: PdfPageInput[],
  outputDir: string,
  prefix?: string
): Promise<string[]> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const baseName = prefix || "page"
  // 元ファイルの読み込みは全ページで共有する
  const pdfCache: SourcePdfCache = new Map()
  const outputPaths: string[] = []

  for (const [index, page] of pages.entries()) {
    const singlePagePdf = await PDFDocument.create()
    const appended = await appendPageToPdf(singlePagePdf, page, pdfCache)
    // 元ファイル欠損・ページ番号不正で1ページも入らなかったら空PDFを作らずに飛ばす
    if (!appended) continue

    const paddedIndex = String(index + 1).padStart(3, "0")
    const outputPath = path.join(outputDir, `${baseName}_${paddedIndex}.pdf`)
    fs.writeFileSync(outputPath, await singlePagePdf.save())
    outputPaths.push(outputPath)
  }

  return outputPaths
}
