import type {
  ImportedFile,
  InterleaveConfig,
  OutputPage,
  PdfExportMode,
  RotationDegree,
} from "@/types/pdfTools.types"

/**
 * 出力ページに適用する回転角を決める。
 * プレビューで個別に回した角度があればそれを、無ければファイル単位の設定を使う。
 */
function resolveRotation(
  pageRotations: Map<string, RotationDegree>,
  fileId: string,
  pageNumber: number,
  fileRotation: RotationDegree
): RotationDegree {
  return pageRotations.get(`${fileId}:${pageNumber}`) ?? fileRotation
}

/**
 * 1ファイル分の出力ページを作る（選択したページを番号順に、2-in-1・回転を反映して）。
 * 2-in-1・回転はファイルの設定（file.nUp / file.rotation）を使うので、
 * 結合・交互挿入のどちらでも同じファイルは同じ見た目になる。
 */
function buildFilePages(
  file: ImportedFile,
  pageRotations: Map<string, RotationDegree>
): OutputPage[] {
  const sortedPages = Array.from(file.selectedPages).sort(
    (pageNumberA, pageNumberB) => pageNumberA - pageNumberB
  )

  if (file.nUp.enabled) {
    // 2-in-1: 2ページずつ結合
    const pages: OutputPage[] = []
    for (let i = 0; i < sortedPages.length; i += 2) {
      const page1 = sortedPages[i]
      const page2 = sortedPages[i + 1]
      pages.push({
        id: crypto.randomUUID(),
        sourceFileId: file.id,
        sourceFileName: file.name,
        sourcePageNumber: page1,
        thumbnail: file.thumbnails[page1 - 1] || "",
        rotation: resolveRotation(pageRotations, file.id, page1, file.rotation),
        isNUpCombined: true,
        combinedPages: page2 ? [page1, page2] : [page1],
        nUpLayout: file.nUp.layout,
      })
    }
    return pages
  }

  return sortedPages.map((pageNumber) => ({
    id: crypto.randomUUID(),
    sourceFileId: file.id,
    sourceFileName: file.name,
    sourcePageNumber: pageNumber,
    thumbnail: file.thumbnails[pageNumber - 1] || "",
    rotation: resolveRotation(
      pageRotations,
      file.id,
      pageNumber,
      file.rotation
    ),
    isNUpCombined: false,
  }))
}

/**
 * インポートされたファイルから出力ページリストを生成
 *
 * @param files - インポートされたファイル一覧
 * @param mode - エクスポートモード（merge, interleave）
 * @param interleaveConfig - 交互挿入設定（ファイルの並びと1回に入れるページ数）
 * @param pageRotations - プレビューで個別に指定されたページ別回転（"fileId:pageNumber"）
 * @returns 生成された出力ページ配列
 */
export function generateOutputPages(
  files: ImportedFile[],
  mode: PdfExportMode,
  interleaveConfig: InterleaveConfig,
  pageRotations: Map<string, RotationDegree>
): OutputPage[] {
  if (mode === "merge") {
    // 結合モード: ファイル順に選択ページを並べる
    return files.flatMap((file) => buildFilePages(file, pageRotations))
  }

  // 交互挿入モード: 各ファイルを pagesPerGroup ページずつに区切り、ファイル順に1組ずつ並べる
  const groupedPages: OutputPage[][][] = []
  for (const transform of interleaveConfig.transforms) {
    const file = files.find(
      (candidateFile) => candidateFile.id === transform.fileId
    )
    if (!file) continue

    const filePages = buildFilePages(file, pageRotations)
    const perGroup = transform.pagesPerGroup || 1
    const chunks: OutputPage[][] = []
    for (let i = 0; i < filePages.length; i += perGroup) {
      chunks.push(filePages.slice(i, i + perGroup))
    }
    groupedPages.push(chunks)
  }

  const pages: OutputPage[] = []
  const maxChunks = Math.max(...groupedPages.map((group) => group.length), 0)
  for (let i = 0; i < maxChunks; i++) {
    for (const chunks of groupedPages) {
      if (chunks[i]) {
        pages.push(...chunks[i])
      }
    }
  }
  return pages
}
