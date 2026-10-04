/**
 * 元PDFのページの読み込み（結合・分割・N-up の面で共有する）
 */
import * as fs from "fs"
import * as path from "path"
import { PDFDocument, type PDFPage } from "pdf-lib"

import type { PdfSourcePageInput } from "@/types/pdfTools.types"

/**
 * 相対パスを絶対パスに解決
 */
function resolveFilePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath
  }
  return path.resolve(process.cwd(), filePath)
}

/**
 * 読み込み済みPDFのキャッシュ。
 * 同じファイルを何度も読み込まないよう、書き出し1回のあいだ共有する。
 */
export type SourcePdfCache = Map<string, PDFDocument>

/** 元ページを読み込む（元ファイルが無い・ページ番号が範囲外なら null） */
export async function loadSourcePage(
  page: PdfSourcePageInput,
  pdfCache: SourcePdfCache
): Promise<{ sourcePdf: PDFDocument; sourcePage: PDFPage } | null> {
  const resolvedPath = resolveFilePath(page.filePath)

  let sourcePdf = pdfCache.get(resolvedPath)
  if (!sourcePdf) {
    if (!fs.existsSync(resolvedPath)) {
      console.warn(
        `File not found: ${resolvedPath} (original: ${page.filePath})`
      )
      return null
    }
    const fileBuffer = fs.readFileSync(resolvedPath)
    // owner-password のみの暗号化PDF（印刷/コピー制限）はユーザーパスワード無しで
    // 内容を読めるため、ignoreEncryption で pdf-lib の EncryptedPDFError を回避する。
    // ユーザーパスワード付きPDFはインポート時に復号済み複製へ差し替え済み。
    sourcePdf = await PDFDocument.load(fileBuffer, {
      ignoreEncryption: true,
    })
    pdfCache.set(resolvedPath, sourcePdf)
  }

  const pageIndex = page.pageNumber - 1
  if (pageIndex < 0 || pageIndex >= sourcePdf.getPageCount()) {
    console.warn(`Invalid page number ${page.pageNumber} for ${resolvedPath}`)
    return null
  }
  return { sourcePdf, sourcePage: sourcePdf.getPage(pageIndex) }
}
