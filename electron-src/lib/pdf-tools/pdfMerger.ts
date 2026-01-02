/**
 * PDF結合ユーティリティ
 * 複数PDFから選択ページを1つのPDFに結合
 */
import { PDFDocument, degrees } from "pdf-lib"
import * as fs from "fs"
import * as path from "path"
import type { RotationDegree, NUpLayout } from "@/types/pdfTools.types"

// A4サイズ (ポイント単位: 1pt = 1/72 inch)
const A4_WIDTH = 595.28 // 210mm
const A4_HEIGHT = 841.89 // 297mm

export interface MergePageInput {
  filePath: string
  pageNumber: number // 1-indexed
  rotation?: RotationDegree
  // 2-in-1用
  isNUpCombined?: boolean
  combinedPages?: number[] // 結合するページ番号 [1, 2]
  nUpLayout?: NUpLayout // "2x1" | "1x2"
}

export interface MergeResult {
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
 * 複数のPDFからページを結合して新しいPDFを作成
 */
export async function mergePdfs(
  pages: MergePageInput[],
  outputPath: string
): Promise<MergeResult> {
  try {
    const mergedPdf = await PDFDocument.create()

    // ファイルキャッシュ（同じファイルを何度も読み込まないように）
    const pdfCache: Map<string, PDFDocument> = new Map()

    for (const page of pages) {
      // パスを解決
      const resolvedPath = resolveFilePath(page.filePath)

      // PDFをキャッシュから取得または読み込み
      let sourcePdf = pdfCache.get(resolvedPath)
      if (!sourcePdf) {
        if (!fs.existsSync(resolvedPath)) {
          console.warn(
            `File not found: ${resolvedPath} (original: ${page.filePath})`
          )
          continue
        }
        const fileBuffer = fs.readFileSync(resolvedPath)
        sourcePdf = await PDFDocument.load(fileBuffer)
        pdfCache.set(resolvedPath, sourcePdf)
      }

      // 2-in-1モードの処理
      if (
        page.isNUpCombined &&
        page.combinedPages &&
        page.combinedPages.length > 0
      ) {
        await addNUpPage(
          mergedPdf,
          sourcePdf,
          page.combinedPages,
          page.nUpLayout || "2x1",
          page.rotation
        )
      } else {
        // 通常モード: 単一ページをコピー
        const pageIndex = page.pageNumber - 1
        if (pageIndex < 0 || pageIndex >= sourcePdf.getPageCount()) {
          console.warn(
            `Invalid page number ${page.pageNumber} for ${resolvedPath}`
          )
          continue
        }

        const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [pageIndex])

        // 回転を適用
        if (page.rotation) {
          const currentRotation = copiedPage.getRotation().angle
          copiedPage.setRotation(degrees(currentRotation + page.rotation))
        }

        mergedPdf.addPage(copiedPage)
      }
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
 */
async function addNUpPage(
  targetPdf: PDFDocument,
  sourcePdf: PDFDocument,
  pageNumbers: number[],
  layout: NUpLayout,
  rotation?: RotationDegree
): Promise<void> {
  // A4サイズの新しいページを作成
  const newPage = targetPdf.addPage([A4_WIDTH, A4_HEIGHT])

  // 各ページを埋め込み
  const embeddedPages: {
    page: Awaited<ReturnType<typeof targetPdf.embedPages>>[0]
    width: number
    height: number
  }[] = []

  for (const pageNum of pageNumbers) {
    const pageIndex = pageNum - 1
    if (pageIndex >= 0 && pageIndex < sourcePdf.getPageCount()) {
      const srcPage = sourcePdf.getPage(pageIndex)
      const { width, height } = srcPage.getSize()
      const [embedded] = await targetPdf.embedPages([srcPage])
      embeddedPages.push({ page: embedded, width, height })
    }
  }

  if (embeddedPages.length === 0) return

  if (layout === "2x1") {
    // 横並び: 各ページを出力ページの半分の幅に収める
    const slotWidth = A4_WIDTH / 2
    const slotHeight = A4_HEIGHT

    embeddedPages.forEach((item, index) => {
      const scale = Math.min(slotWidth / item.width, slotHeight / item.height)
      const scaledW = item.width * scale
      const scaledH = item.height * scale
      const offsetX = (slotWidth - scaledW) / 2
      const offsetY = (slotHeight - scaledH) / 2
      const x = index === 0 ? offsetX : slotWidth + offsetX

      newPage.drawPage(item.page, {
        x,
        y: offsetY,
        xScale: scale,
        yScale: scale,
      })
    })
  } else {
    // 縦並び (1x2): 各ページを出力ページの半分の高さに収める
    const slotWidth = A4_WIDTH
    const slotHeight = A4_HEIGHT / 2

    embeddedPages.forEach((item, index) => {
      const scale = Math.min(slotWidth / item.width, slotHeight / item.height)
      const scaledW = item.width * scale
      const scaledH = item.height * scale
      const offsetX = (slotWidth - scaledW) / 2
      const offsetY = (slotHeight - scaledH) / 2
      // index 0 = 上、index 1 = 下
      const y = index === 0 ? slotHeight + offsetY : offsetY

      newPage.drawPage(item.page, {
        x: offsetX,
        y,
        xScale: scale,
        yScale: scale,
      })
    })
  }

  // 回転を適用
  if (rotation) {
    const currentRotation = newPage.getRotation().angle
    newPage.setRotation(degrees(currentRotation + rotation))
  }
}
