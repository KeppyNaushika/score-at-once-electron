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

/** 出力ページを「どの元ページか」で同定するキー（除外・回転のキーと揃える） */
export function outputPageKey(page: OutputPage): string {
  return sourcePageKey(page.sourceFileId, page.sourcePageNumber)
}

/**
 * ページの並び順。元ファイルの**全ページ**（選択していないページも）のキーを並べたもの。
 *
 * 選択の有無は、この順の上で出すかどうかを決めるだけなので、選択を外して戻しても
 * 位置は変わらない。出力の順を決めるのはこれだけで、結合・交互挿入の設定は、変えた
 * ときにこの順を1回作り直すのに使う（`rebuildPageOrder`）。作り直した後はドラッグで
 * 自由に直せる。
 */
export type PageOrder = string[]

/**
 * 見えている一覧でのドラッグを、並び順に写す。
 *
 * 動かしたページを、移動先のページの直前（後ろへ動かしたなら直後）へ移す。
 * ほかのページ（見えていないものも）は互いの位置関係を保つ。
 */
export function movePageInOrder(
  pageOrder: PageOrder,
  movedKey: string,
  targetKey: string,
  placement: "before" | "after"
): PageOrder {
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
  return pageOrder.filter((pageKey) => !isSourcePageKeyOf(pageKey, fileId))
}

/**
 * 結合・交互挿入の設定から、ページの並び順を作り直す。
 *
 * 出力モードや、交互挿入で1回に入れるページ数を変えたときに1回だけ呼び、その結果を
 * 並び順として持つ（それまでにドラッグで直した順は、新しい設定の順に置き換わる）。
 * 全ページを並べるので、選択していないページにも位置が付く。
 *
 * N-up は見ない。面は並び順の後で組む（`groupIntoSheets`）ので、N を変えても並び順は
 * 変わらず、作り直しもしない。1回に入れるページ数は元ページの枚数で数える（N=2 の
 * ファイルを2枚ずつ入れれば、面と他のファイルのページが交互になる）。
 */
export function rebuildPageOrder(
  files: ImportedFile[],
  mode: PdfExportMode,
  interleaveConfig: InterleaveConfig
): PageOrder {
  if (mode === "merge") return files.flatMap(filePageKeys)

  // 交互挿入: 各ファイルを pagesPerGroup ページずつに区切り、ファイル順に1組ずつ並べる
  const chunkedFiles = interleaveConfig.transforms.flatMap((transform) => {
    const file = files.find(
      (candidateFile) => candidateFile.id === transform.fileId
    )
    if (!file) return []
    const pageKeys = filePageKeys(file)
    const perGroup = Math.max(transform.pagesPerGroup, 1)
    return [
      Array.from({ length: Math.ceil(pageKeys.length / perGroup) }, (_, i) =>
        pageKeys.slice(i * perGroup, (i + 1) * perGroup)
      ),
    ]
  })
  const roundCount = Math.max(0, ...chunkedFiles.map((chunks) => chunks.length))
  const arrangedKeys = Array.from({ length: roundCount }, (_, round) =>
    chunkedFiles.flatMap((chunks) => chunks[round] ?? [])
  ).flat()

  // 交互挿入の設定に載っていないファイルも、並び順からは落とさない
  const arrangedKeySet = new Set(arrangedKeys)
  const missingKeys = files
    .flatMap(filePageKeys)
    .filter((pageKey) => !arrangedKeySet.has(pageKey))
  return [...arrangedKeys, ...missingKeys]
}
