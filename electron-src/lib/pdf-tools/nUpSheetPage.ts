/**
 * N-up の面（入れ子の全体 N-up も）を、出力PDFの1ページとして描く
 */
import {
  degrees,
  type PDFDocument,
  type PDFEmbeddedPage,
  type PDFPage,
} from "pdf-lib"

import {
  layoutNestedSheet,
  type LayoutPage,
  type LayoutSheet,
} from "@/lib/pdf-tools/nestedSheetLayout"
import {
  A4_PAPER,
  normalizeRotation,
  toPdfDrawing,
} from "@/lib/pdf-tools/nUpLayout"
import type { PdfNUpSheetInput, PdfPageInput } from "@/types/pdfTools.types"

import { loadSourcePage, type SourcePdfCache } from "./sourcePdfPages"

/** 読み込んだ元ページ（面の木の葉） */
interface LoadedSourcePage {
  sourcePdf: PDFDocument
  sourcePage: PDFPage
}

/**
 * 面の元ページを読み込み、配置を計算する木にする（読めないページは空きスロット）。
 *
 * 寸法は /Rotate を含まない向き（getSize）で持ち、回転は /Rotate と指定の回転を足して
 * 持つ。埋め込んだページは /Rotate を含まない向きで描かれるので、こうしないと /Rotate
 * 付きのページが横倒しの縦横で収められる。
 */
async function loadLayoutSheet(
  sheet: PdfNUpSheetInput,
  pdfCache: SourcePdfCache
): Promise<LayoutSheet<LoadedSourcePage>> {
  // スロット順に1つずつ読み込む（並行にすると同じ元ファイルを二重に読み込む）
  const slots: LayoutSheet<LoadedSourcePage>["slots"] = []
  for (const slot of sheet.slots) {
    slots.push(slot ? await loadLayoutSlot(slot, pdfCache) : null)
  }
  return { kind: "sheet", nUp: sheet.nUp, slots }
}

async function loadLayoutSlot(
  slot: PdfPageInput,
  pdfCache: SourcePdfCache
): Promise<
  LayoutPage<LoadedSourcePage> | LayoutSheet<LoadedSourcePage> | null
> {
  if (slot.kind === "sheet") return await loadLayoutSheet(slot, pdfCache)
  const loaded = await loadSourcePage(slot, pdfCache)
  if (!loaded) return null
  const { width, height } = loaded.sourcePage.getSize()
  return {
    kind: "page",
    leaf: loaded,
    width,
    height,
    rotation: normalizeRotation(
      loaded.sourcePage.getRotation().angle + slot.rotation
    ),
  }
}

/**
 * 元ページを出力PDFへ埋め込む（元ページ → 埋め込んだページ）。
 *
 * 元ファイルごとに1回の embedPages にまとめる。同じ呼び出しの中では、ページ間で
 * 共有するフォントなどの資源を1回だけ複製するので、1つの面に同じファイルのページが
 * 何枚あっても資源が重複しない。
 */
async function embedSourcePages(
  targetPdf: PDFDocument,
  sourcePages: LoadedSourcePage[]
): Promise<Map<PDFPage, PDFEmbeddedPage>> {
  const pagesBySourcePdf = new Map<PDFDocument, PDFPage[]>()
  sourcePages.forEach(({ sourcePdf, sourcePage }) => {
    pagesBySourcePdf.set(sourcePdf, [
      ...(pagesBySourcePdf.get(sourcePdf) ?? []),
      sourcePage,
    ])
  })
  const embeddedPageBySourcePage = new Map<PDFPage, PDFEmbeddedPage>()
  for (const pages of pagesBySourcePdf.values()) {
    const embeddedPages = await targetPdf.embedPages(pages)
    pages.forEach((page, pageIndex) =>
      embeddedPageBySourcePage.set(page, embeddedPages[pageIndex])
    )
  }
  return embeddedPageBySourcePage
}

/**
 * N-up の面を1ページ作って追加する。
 *
 * 面の木（全体の面のスロットにファイルごとの面が入る）を葉ごとの置き場所に畳み、
 * 元ページを1枚ずつ、スロットの中でそのページだけを回して置く（面全体は回さない）。
 * 内側の面を一度ページにしてから縮めることはしないので、入れ子でも画質は変わらない。
 *
 * @returns 追加できた場合 true。全スロットが読めず追加しなかった場合 false
 */
export async function addNUpSheet(
  targetPdf: PDFDocument,
  sheet: PdfNUpSheetInput,
  pdfCache: SourcePdfCache
): Promise<boolean> {
  // スロット配置はPNG出力(canvas)・プレビューと共有する純粋関数で計算する
  const layout = layoutNestedSheet(
    await loadLayoutSheet(sheet, pdfCache),
    A4_PAPER
  )
  if (!layout) return false

  const embeddedPageBySourcePage = await embedSourcePages(
    targetPdf,
    layout.leaves.map(({ leaf }) => leaf)
  )

  const sheetPage = targetPdf.addPage([layout.paper.width, layout.paper.height])

  layout.leaves.forEach(({ leaf, placement, rotation }) => {
    const embeddedPage = embeddedPageBySourcePage.get(leaf.sourcePage)
    if (!embeddedPage) return
    const drawing = toPdfDrawing(placement, rotation, layout.paper.height)
    sheetPage.drawPage(embeddedPage, {
      x: drawing.x,
      y: drawing.y,
      width: drawing.width,
      height: drawing.height,
      rotate: degrees(drawing.counterClockwiseDegrees),
    })
  })

  return true
}
