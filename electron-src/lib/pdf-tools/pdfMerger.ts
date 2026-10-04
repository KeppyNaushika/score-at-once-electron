/**
 * PDF結合ユーティリティ
 * 複数PDFから選択ページを1つのPDFに結合
 */
import * as fs from "fs"
import * as path from "path"
import { degrees, PDFDocument, type PDFPage } from "pdf-lib"

import {
  A4_PAPER,
  computeSheetLayout,
  normalizeRotation,
  toPdfDrawing,
} from "@/lib/pdf-tools/nUpLayout"
import type {
  PdfNUpSheetInput,
  PdfPageInput,
  PdfSheetSlotInput,
  PdfSourcePageInput,
} from "@/types/pdfTools.types"

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
async function loadSourcePage(
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

/** 面のスロットに置く元ページを埋め込む（読めなければ null） */
async function embedSlotPage(
  targetPdf: PDFDocument,
  slot: PdfSheetSlotInput,
  pdfCache: SourcePdfCache
) {
  const loaded = await loadSourcePage(slot, pdfCache)
  if (!loaded) return null
  // getSize は /Rotate を含まない向きの寸法。回転は /Rotate と指定の回転を足して持つ
  const { width, height } = loaded.sourcePage.getSize()
  const [embeddedPage] = await targetPdf.embedPages([loaded.sourcePage])
  return {
    embeddedPage,
    width,
    height,
    rotation: normalizeRotation(
      loaded.sourcePage.getRotation().angle + slot.rotation
    ),
  }
}

/**
 * N-up の面を1ページ作って追加する。
 *
 * 各スロットの元ページを埋め込み、スロットの中でそのページだけを回して置く
 * （面全体は回さない）。埋め込んだページは元PDFの /Rotate を含まない向きで描かれる
 * ので、/Rotate と指定の回転を足した角度で回す。寸法も /Rotate を反映した向きで
 * 配置を決める（そうしないと、/Rotate 付きのページが横倒しの縦横で収められる）。
 *
 * @returns 追加できた場合 true。全スロットが読めず追加しなかった場合 false
 */
async function addNUpSheet(
  targetPdf: PDFDocument,
  sheet: PdfNUpSheetInput,
  pdfCache: SourcePdfCache
): Promise<boolean> {
  // スロット順に1つずつ埋め込む（並行にすると同じ元ファイルを二重に読み込む）。
  // 読めないページは空スロット(null)
  const slots: Awaited<ReturnType<typeof embedSlotPage>>[] = []
  for (const slot of sheet.slots) {
    slots.push(slot ? await embedSlotPage(targetPdf, slot, pdfCache) : null)
  }

  if (slots.every((slot) => slot === null)) return false

  // スロット配置はPNG出力(canvas)と共有する純粋関数で計算する
  const layout = computeSheetLayout(sheet.nUp, slots, A4_PAPER)

  const sheetPage = targetPdf.addPage([layout.paper.width, layout.paper.height])

  layout.placements.forEach((placement, slotIndex) => {
    const slot = slots[slotIndex]
    if (!placement || !slot) return
    const drawing = toPdfDrawing(placement, slot.rotation, layout.paper.height)
    sheetPage.drawPage(slot.embeddedPage, {
      x: drawing.x,
      y: drawing.y,
      width: drawing.width,
      height: drawing.height,
      rotate: degrees(drawing.counterClockwiseDegrees),
    })
  })

  return true
}
