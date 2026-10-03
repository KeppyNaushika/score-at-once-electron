import type {
  ImportedFile,
  InterleaveConfig,
  OutputPage,
  PdfExportMode,
} from "@/types/pdfTools.types"

/**
 * 元ファイルの1ページを同定するキー（"fileId:pageNumber"）。
 *
 * 並べ替えた順・除外・個別の回転は、どれもこのキーで元ページを指す。綴りを各所で
 * 手書きすると、片方だけ変えたときに対応が黙ってずれるので、作るのはここだけ。
 */
export function sourcePageKey(fileId: string, pageNumber: number): string {
  return `${filePrefixOf(fileId)}${pageNumber}`
}

/** そのファイルのページのキーが共通に持つ頭 */
function filePrefixOf(fileId: string): string {
  return `${fileId}:`
}

/** キーがそのファイルのページを指しているか */
export function isSourcePageKeyOf(pageKey: string, fileId: string): boolean {
  return pageKey.startsWith(filePrefixOf(fileId))
}

/**
 * 出力ページを「どの元ページか」で同定するキー。
 * 2-in-1で結合したページは先頭ページ番号で代表する（除外・回転のキーと揃える）。
 */
export function outputPageKey(page: OutputPage): string {
  return sourcePageKey(page.sourceFileId, page.sourcePageNumber)
}

/**
 * ページの並び順。元ファイルの**全ページ**（選択していないページも）のキーを並べたもの。
 *
 * 選択の有無は、この順の上で出すかどうかを決めるだけなので、選択を外して戻しても
 * 位置は変わらない。並べ替えていなければ null で、設定から作った順をそのまま使う。
 */
export type PageOrder = string[] | null

/**
 * 設定から作った出力ページを、ページの並び順に並べる。
 *
 * 2-in-1で結合したページは先頭ページの位置に並ぶ。並び順に無いページ（無いはずだが）は
 * 作った順のまま末尾に置く。
 */
export function arrangeByPageOrder(
  generatedPages: OutputPage[],
  pageOrder: PageOrder
): OutputPage[] {
  if (pageOrder === null) return generatedPages
  const rankByKey = new Map(
    pageOrder.map((pageKey, rank) => [pageKey, rank] as const)
  )
  const rankOf = (page: OutputPage) =>
    rankByKey.get(outputPageKey(page)) ?? pageOrder.length
  return generatedPages.toSorted(
    (pageA, pageB) => rankOf(pageA) - rankOf(pageB)
  )
}

/**
 * 初めて並べ替えるときの並び順を作る。
 *
 * 全ページを並べた既定の順（`allPageKeys`）の上で、いま見えているページの位置に
 * 見えている順（`displayedPages`）を詰め直す。見えていないページは既定の位置に残る。
 */
export function initialPageOrder(
  allPageKeys: string[],
  displayedPages: OutputPage[]
): string[] {
  const displayedKeys = displayedPages.map(outputPageKey)
  const displayedKeySet = new Set(displayedKeys)
  let nextDisplayedIndex = 0
  return allPageKeys.map((pageKey) =>
    displayedKeySet.has(pageKey) ? displayedKeys[nextDisplayedIndex++] : pageKey
  )
}

/**
 * 見えている一覧でのドラッグを、並び順に写す。
 *
 * 動かしたページを、移動先のページの直前（後ろへ動かしたなら直後）へ移す。
 * ほかのページ（見えていないものも）は互いの位置関係を保つ。
 */
export function movePageInOrder(
  pageOrder: string[],
  movedKey: string,
  targetKey: string,
  placement: "before" | "after"
): string[] {
  const remainingKeys = pageOrder.filter((pageKey) => pageKey !== movedKey)
  const targetIndex = remainingKeys.indexOf(targetKey)
  if (targetIndex === -1) return pageOrder
  const insertIndex = placement === "before" ? targetIndex : targetIndex + 1
  return remainingKeys.toSpliced(insertIndex, 0, movedKey)
}

/** 取り込んだファイルの全ページのキー（ページ番号順） */
export function filePageKeys(file: ImportedFile): string[] {
  return Array.from({ length: file.pageCount }, (_, i) =>
    sourcePageKey(file.id, i + 1)
  )
}

/** 並び順から、指定したファイルのページを除く */
export function withoutFilePageOrder(
  pageOrder: PageOrder,
  fileId: string
): PageOrder {
  if (pageOrder === null) return null
  return pageOrder.filter((pageKey) => !isSourcePageKeyOf(pageKey, fileId))
}

/**
 * 並べる方式が変わったか。出力モード、または交互挿入で1回に入れるページ数の変更を指す。
 * これを変えるのは順を選び直す操作なので、変えたら並べ替えた順を捨てる（捨てないと、
 * 方式を変えても見た目が何も変わらない）。ファイルの追加・削除に伴う交互挿入設定の
 * 増減、2-in-1・回転の変更は含めない（これらは並べ替えた順を保ったまま反映する）。
 */
export function isArrangementChanged(
  previous: { exportMode: PdfExportMode; interleaveConfig: InterleaveConfig },
  current: { exportMode: PdfExportMode; interleaveConfig: InterleaveConfig }
): boolean {
  if (previous.exportMode !== current.exportMode) return true
  if (current.exportMode !== "interleave") return false
  const previousPagesPerGroupByFileId = new Map(
    previous.interleaveConfig.transforms.map((transform) => [
      transform.fileId,
      transform.pagesPerGroup,
    ])
  )
  return current.interleaveConfig.transforms.some((transform) => {
    const previousPagesPerGroup = previousPagesPerGroupByFileId.get(
      transform.fileId
    )
    return (
      previousPagesPerGroup !== undefined &&
      previousPagesPerGroup !== transform.pagesPerGroup
    )
  })
}
