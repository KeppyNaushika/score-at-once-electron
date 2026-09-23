import type { OutputPage } from "@/types/pdfTools.types"

/**
 * 出力ページを「どの元ページか」で同定するキー（"fileId:pageNumber"）。
 * 出力ページの id は作り直すたびに変わるので、並べ替えた順を覚えるにはこちらを使う。
 * 2-in-1で結合したページは先頭ページ番号で代表する（除外・回転のキーと揃える）。
 */
export function outputPageKey(page: OutputPage): string {
  return `${page.sourceFileId}:${page.sourcePageNumber}`
}

/**
 * 設定から作り直した出力ページを、利用者がドラッグで並べ替えた順に並べる。
 *
 * - 並べ替えた順（manualOrderKeys）に残っているページは、その順で並べる。
 * - 新しく増えたページ（ページの選択・2-in-1の解除など）は、作り直した並び（generatedPages）で
 *   同じファイルの直前にあるページのすぐ後ろに差し込む。同じファイルに直前のページが無ければ、
 *   同じファイルの直後にあるページのすぐ前。ファイルごと増えたときは末尾に足す。
 * - 減ったページ（選択を外した・2-in-1で相方に吸収された）は、そのまま消える。
 */
export function arrangeInManualOrder(
  generatedPages: OutputPage[],
  manualOrderKeys: string[]
): OutputPage[] {
  const manualRankByKey = new Map<string, number>()
  manualOrderKeys.forEach((pageKey, rank) => {
    if (!manualRankByKey.has(pageKey)) manualRankByKey.set(pageKey, rank)
  })

  // 並べ替えた順に残っているページを、その順で並べる
  const arrangedPages = generatedPages
    .filter((page) => manualRankByKey.has(outputPageKey(page)))
    .sort(
      (pageA, pageB) =>
        (manualRankByKey.get(outputPageKey(pageA)) ?? 0) -
        (manualRankByKey.get(outputPageKey(pageB)) ?? 0)
    )

  // 増えたページを、作り直した並びで前から順に差し込む。前にある同じファイルのページは
  // 既に arrangedPages に入っている（残ったページか、先に差し込んだページ）。
  generatedPages.forEach((page, generatedIndex) => {
    if (manualRankByKey.has(outputPageKey(page))) return
    const isSameFile = (otherPage: OutputPage) =>
      otherPage.sourceFileId === page.sourceFileId
    const precedingPage = generatedPages
      .slice(0, generatedIndex)
      .findLast(isSameFile)
    if (precedingPage) {
      arrangedPages.splice(arrangedPages.indexOf(precedingPage) + 1, 0, page)
      return
    }
    const followingPage = generatedPages
      .slice(generatedIndex + 1)
      .find(
        (otherPage) =>
          isSameFile(otherPage) && manualRankByKey.has(outputPageKey(otherPage))
      )
    if (followingPage) {
      arrangedPages.splice(arrangedPages.indexOf(followingPage), 0, page)
      return
    }
    arrangedPages.push(page)
  })

  return arrangedPages
}
