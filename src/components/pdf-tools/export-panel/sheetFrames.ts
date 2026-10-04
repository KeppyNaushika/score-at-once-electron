import type { PagePlacement } from "./pagePlacements"

/** カードを入れる面1つ分の枠（段と、隣のマスとつなぐか） */
export interface SheetFrameSpec {
  key: string
  /** 0 が最も外側の面（出力の1ページ）。全体 N-up では 1 がファイルごとの面 */
  level: number
  /** 同じ行の左隣が同じ面か（枠の左辺を開けてつなぐ） */
  joinsPrevious: boolean
  /** 同じ行の右隣が同じ面か（枠の右辺を開けてつなぐ） */
  joinsNext: boolean
}

/**
 * プレビューの各カードに描く、面をくくる枠（ページの id → 外側の面からの枠）。
 *
 * 枠は面の段ごとに描き、同じ行で隣のカードが同じ段の同じ面なら辺を開けてつなぐ
 * （行をまたぐ面は行ごとに閉じる）。面の id は段をまたぐと同じ値になりうるので
 * （全体の面の id は、先頭に入るファイルごとの面の id と同じ）、同じ段どうしで比べる。
 *
 * @param pageIds プレビューに並べる順のページの id
 * @param columns 1行あたりのカードの数
 */
export function sheetFramesByPageId(
  pageIds: string[],
  placementByPageId: ReadonlyMap<string, PagePlacement>,
  columns: number
): Map<string, SheetFrameSpec[]> {
  const isSameSheetAs = (
    pageIndex: number,
    neighborIndex: number,
    level: number
  ) => {
    const isSameRow =
      Math.floor(pageIndex / columns) === Math.floor(neighborIndex / columns)
    const neighborId = pageIds[neighborIndex]
    if (!isSameRow || neighborId === undefined) return false
    const sheetId = placementByPageId.get(pageIds[pageIndex])?.sheetIds[level]
    return (
      sheetId !== undefined &&
      placementByPageId.get(neighborId)?.sheetIds[level] === sheetId
    )
  }
  return new Map(
    pageIds.map((pageId, pageIndex) => [
      pageId,
      (placementByPageId.get(pageId)?.sheetIds ?? []).map((sheetId, level) => ({
        key: `${level}:${sheetId}`,
        level,
        joinsPrevious: isSameSheetAs(pageIndex, pageIndex - 1, level),
        joinsNext: isSameSheetAs(pageIndex, pageIndex + 1, level),
      })),
    ])
  )
}
