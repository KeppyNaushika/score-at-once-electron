import type {
  ImportedFile,
  NUpSheet,
  OutputPage,
  OutputSheet,
  RotationDegree,
} from "@/types/pdfTools.types"

import { type PageOrder, sourcePageKey } from "./outputPageOrder"

/** 出力の材料: ファイルの設定と、利用者の操作（並び順・除外・回転） */
interface OutputPageSettings {
  files: ImportedFile[]
  pageRotations: Map<string, RotationDegree>
  pageOrder: PageOrder
  excludedPages: Set<string>
}

/**
 * 出力に載るページを、並び順のとおりに並べる。
 *
 * 並び順（全ページ）から、選択していて除外していないページだけを残す。面（N-up）は
 * まだ組まない。組むのはこの後（`groupIntoSheets`）なので、除外したページは詰められ、
 * ドラッグで並びを変えれば組み合わせも変わる。
 *
 * 回転はプレビューで個別に回した角度があればそれを、無ければファイル単位の設定を使う。
 */
export function deriveOutputPages(settings: OutputPageSettings): OutputPage[] {
  const sourcePageByKey = new Map(
    settings.files.flatMap((file) =>
      Array.from({ length: file.pageCount }, (_, i) => {
        const pageNumber = i + 1
        return [
          sourcePageKey(file.id, pageNumber),
          { file, pageNumber },
        ] as const
      })
    )
  )
  return settings.pageOrder.flatMap((pageKey): OutputPage[] => {
    const sourcePage = sourcePageByKey.get(pageKey)
    if (!sourcePage) return []
    const { file, pageNumber } = sourcePage
    if (!file.selectedPages.has(pageNumber)) return []
    if (settings.excludedPages.has(pageKey)) return []
    return [
      {
        kind: "page",
        id: pageKey,
        sourceFileId: file.id,
        sourceFileName: file.name,
        sourcePageNumber: pageNumber,
        thumbnail: file.thumbnails[pageNumber - 1] || "",
        rotation: settings.pageRotations.get(pageKey) ?? file.rotation,
      },
    ]
  })
}

/**
 * 並んだページを、ファイルごとの N-up の面にまとめる（出力の1ページ = 1要素）。
 *
 * 各ファイルについて、並びからそのファイルのページだけを順に取り出し、N 枚ずつ1面に
 * する（間に他のファイルのページがあっても飛ばして組む）。面は並びの上で先頭ページの
 * 位置に置き、id は先頭ページのキーにする。N で割り切れない最後の面は空きスロット
 * （null）を残す。N=1 のファイルのページは面にせず、そのまま1ページとして出す。
 */
export function groupIntoSheets(
  pages: OutputPage[],
  files: ImportedFile[]
): OutputSheet[] {
  const nUpByFileId = new Map(files.map((file) => [file.id, file.nUp]))

  // ファイルごとに、そのファイルのページを並びの順に集める
  const pagesByFileId = Map.groupBy(pages, (page) => page.sourceFileId)

  // 面の先頭ページの id → 面
  const sheetByFirstPageId = new Map<string, NUpSheet>()
  for (const [fileId, filePages] of pagesByFileId) {
    const nUp = nUpByFileId.get(fileId)
    if (!nUp || nUp.pagesPerSheet === 1) continue
    const sheetCount = Math.ceil(filePages.length / nUp.pagesPerSheet)
    Array.from({ length: sheetCount }, (_, sheetIndex) =>
      filePages.slice(
        sheetIndex * nUp.pagesPerSheet,
        (sheetIndex + 1) * nUp.pagesPerSheet
      )
    ).forEach((sheetPages) => {
      sheetByFirstPageId.set(sheetPages[0].id, {
        kind: "sheet",
        id: sheetPages[0].id,
        nUp,
        slots: Array.from(
          { length: nUp.pagesPerSheet },
          (_, slotIndex) => sheetPages[slotIndex] ?? null
        ),
      })
    })
  }

  return pages.flatMap((page): OutputSheet[] => {
    const nUp = nUpByFileId.get(page.sourceFileId)
    if (!nUp || nUp.pagesPerSheet === 1) return [page]
    // 面の2枚目以降は、先頭ページの位置に置いた面の中に入っている
    const sheet = sheetByFirstPageId.get(page.id)
    return sheet ? [sheet] : []
  })
}
