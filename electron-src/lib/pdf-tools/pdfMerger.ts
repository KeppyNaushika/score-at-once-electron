/**
 * PDF結合ユーティリティ
 * 複数PDFから選択ページを1つのPDFに結合
 */
import * as fs from "fs"
import * as path from "path"
import { degrees, PDFDocument } from "pdf-lib"

import { computeNUpLayout } from "@/lib/pdf-tools/nUpLayout"
import type {
  NUpLayout,
  PdfPageInput,
  RotationDegree,
} from "@/types/pdfTools.types"

// A4サイズ (ポイント単位: 1pt = 1/72 inch)
const A4_WIDTH = 595.28 // 210mm
const A4_HEIGHT = 841.89 // 297mm

interface MergeResult {
  success: boolean
  outputPath?: string
  error?: string
}

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

/**
 * ページ入力を解決して対象PDFへ1ページ追加する。
 *
 * 結合（1ファイルへ全ページ）とページ別書き出し（1ページ1ファイル）で
 * 同じ変換（2-in-1合成・回転）を共有するための単位。
 *
 * @returns 追加できた場合 true。元ファイルやページ番号が無効で飛ばした場合 false
 */
export async function appendPageToPdf(
  targetPdf: PDFDocument,
  page: PdfPageInput,
  pdfCache: SourcePdfCache
): Promise<boolean> {
  const resolvedPath = resolveFilePath(page.filePath)

  let sourcePdf = pdfCache.get(resolvedPath)
  if (!sourcePdf) {
    if (!fs.existsSync(resolvedPath)) {
      console.warn(
        `File not found: ${resolvedPath} (original: ${page.filePath})`
      )
      return false
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

  // 2-in-1モードの処理
  if (
    page.isNUpCombined &&
    page.combinedPages &&
    page.combinedPages.length > 0
  ) {
    return await addNUpPage(
      targetPdf,
      sourcePdf,
      page.combinedPages,
      page.nUpLayout || "2x1",
      page.rotation
    )
  }

  // 通常モード: 単一ページをコピー
  const pageIndex = page.pageNumber - 1
  if (pageIndex < 0 || pageIndex >= sourcePdf.getPageCount()) {
    console.warn(`Invalid page number ${page.pageNumber} for ${resolvedPath}`)
    return false
  }

  const [copiedPage] = await targetPdf.copyPages(sourcePdf, [pageIndex])

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
): Promise<MergeResult> {
  try {
    const mergedPdf = await PDFDocument.create()
    const pdfCache: SourcePdfCache = new Map()

    for (const page of pages) {
      await appendPageToPdf(mergedPdf, page, pdfCache)
    }

    // PDFを保存
    const pdfBytes = await mergedPdf.save()
    fs.writeFileSync(outputPath, pdfBytes)

    return { success: true, outputPath }
  } catch (error) {
    console.error("PDF merge error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 2-in-1ページを作成して追加
 *
 * @returns 追加できた場合 true。全スロットが範囲外で追加しなかった場合 false
 */
async function addNUpPage(
  targetPdf: PDFDocument,
  sourcePdf: PDFDocument,
  pageNumbers: number[],
  layout: NUpLayout,
  rotation?: RotationDegree
): Promise<boolean> {
  // 各ページをスロット順(=pageNumbers順)に埋め込む。範囲外ページは空スロット(null)
  const slots: ({
    page: Awaited<ReturnType<typeof targetPdf.embedPages>>[0]
    width: number
    height: number
  } | null)[] = []

  for (const pageNum of pageNumbers) {
    const pageIndex = pageNum - 1
    if (pageIndex >= 0 && pageIndex < sourcePdf.getPageCount()) {
      const srcPage = sourcePdf.getPage(pageIndex)
      const { width, height } = srcPage.getSize()
      const [embedded] = await targetPdf.embedPages([srcPage])
      slots.push({ page: embedded, width, height })
    } else {
      slots.push(null)
    }
  }

  if (slots.every((slot) => slot === null)) return false

  // スロット配置はPNG出力(canvas)と共有する純粋関数で計算する
  const { pageWidth, pageHeight, placements } = computeNUpLayout(
    layout,
    slots.map((slot) =>
      slot ? { width: slot.width, height: slot.height } : null
    ),
    { width: A4_WIDTH, height: A4_HEIGHT }
  )

  const newPage = targetPdf.addPage([pageWidth, pageHeight])

  placements.forEach((placement, index) => {
    const slot = slots[index]
    if (!placement || !slot) return
    // computeNUpLayout は左上原点。pdf-lib は左下原点なので y を変換する
    const y = pageHeight - (placement.yTop + placement.height)
    newPage.drawPage(slot.page, {
      x: placement.x,
      y,
      width: placement.width,
      height: placement.height,
    })
  })

  // 回転を適用
  if (rotation) {
    const currentRotation = newPage.getRotation().angle
    newPage.setRotation(degrees(currentRotation + rotation))
  }

  return true
}
