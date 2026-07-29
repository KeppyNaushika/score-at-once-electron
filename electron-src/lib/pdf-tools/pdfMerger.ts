/**
 * PDF結合ユーティリティ
 * 複数PDFから選択ページを1つのPDFに結合
 */
import * as fs from "fs"
import * as path from "path"
import { degrees, PDFDocument } from "pdf-lib"

import { computeNUpLayout } from "@/lib/pdf-tools/nUpLayout"
import type { NUpLayout, RotationDegree } from "@/types/pdfTools.types"

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

  if (slots.every((slot) => slot === null)) return

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
}
