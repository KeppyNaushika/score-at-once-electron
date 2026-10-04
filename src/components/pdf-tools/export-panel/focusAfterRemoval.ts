/**
 * プレビューのカードを除外したあと、フォーカスを移すカード（ページの id）。
 *
 * 並び順で次のカード、無ければ前のカード。除外したカードが消えるとフォーカスが
 * 文書の先頭へ落ち、キーボードで続けて操作できなくなるので、隣へ移す。
 * 除外したのが最後の1枚なら移す先は無い（undefined）。
 */
export function pageIdToFocusAfterRemoval(
  pageIds: readonly string[],
  removedPageId: string
): string | undefined {
  const removedIndex = pageIds.indexOf(removedPageId)
  if (removedIndex === -1) return undefined
  return pageIds[removedIndex + 1] ?? pageIds[removedIndex - 1]
}
