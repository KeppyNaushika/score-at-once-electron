import {
  layoutNestedSheet,
  type SheetCellPosition,
} from "@/lib/pdf-tools/nestedSheetLayout"
import { A4_PAPER, type NUpRect, type NUpSize } from "@/lib/pdf-tools/nUpLayout"
import type { NUpSheet, OutputPage, OutputSheet } from "@/types/pdfTools.types"

import { sheetLeafPages, toLayoutSheet } from "./outputSheets"

/** ページが出力用紙の上のどこに来るか（バッジの図に使う） */
export interface PaperFigure {
  /** 出力用紙（向きは出力と同じく中身から決めたもの） */
  paper: NUpSize
  /** 同じ出力ページに載るページの外形（回した後。読む順） */
  pageRects: { pageId: string; rect: NUpRect }[]
  /** 図で塗るページ（このページ）の id */
  targetPageId: string
}

/** ページが出力のどこに入るか */
export interface PagePlacement {
  /** 出力の何ページ目か（1始まり） */
  outputPageNumber: number
  /**
   * 入っている面の id。外側の面から順に（全体の面、ファイルごとの面）。面に入らなければ空。
   * 入れ子の面と外側の面で id が同じになりうるので、同じ段どうしで比べる
   */
  sheetIds: string[]
  /**
   * 出力ページの中の何枚目か（1始まり。読む順＝面の木をスロットの順にたどった順）。
   * 面に入らなければ無い
   */
  slotNumber?: number
  /** 各段の面の格子のどのマスに入るか（外側から。寸法が揃うまでは無い） */
  cellPath?: SheetCellPosition[]
  /** 出力用紙の上のどこに来るか（寸法が揃うまでは無い） */
  paperFigure?: PaperFigure
}

/**
 * 各ページが出力の何ページ目の、何枚目（用紙のどこ）に入るか（ページの id → 位置）。
 *
 * @param thumbnailSizes ページの id → サムネイル画像の寸法（回す前）。読み込み中の
 *   ページは入っておらず、読めなかったページは null
 */
export function pagePlacements(
  sheets: OutputSheet[],
  thumbnailSizes: ReadonlyMap<string, NUpSize | null>
): Map<string, PagePlacement> {
  return new Map(
    sheets.flatMap((sheet, sheetIndex): [string, PagePlacement][] => {
      const outputPageNumber = sheetIndex + 1
      if (sheet.kind === "page") {
        return [[sheet.id, { outputPageNumber, sheetIds: [] }]]
      }
      const layout = measuredSheetLayout(sheet, thumbnailSizes)
      const pageRects =
        layout?.leaves.map((leaf) => ({
          pageId: leaf.leaf.id,
          rect: leaf.placement,
        })) ?? []
      const leafByPageId = new Map(
        layout?.leaves.map((leaf) => [leaf.leaf.id, leaf])
      )
      return sheetIdPaths(sheet).map(({ page, sheetIds }, pageIndex) => {
        const leaf = leafByPageId.get(page.id)
        return [
          page.id,
          {
            outputPageNumber,
            sheetIds,
            slotNumber: pageIndex + 1,
            cellPath: leaf?.cellPath,
            paperFigure:
              layout && leaf
                ? { paper: layout.paper, pageRects, targetPageId: page.id }
                : undefined,
          },
        ]
      })
    })
  )
}

/** 面の元ページを読む順に並べ、それぞれが入る面の id（外側から）を添える */
function sheetIdPaths(
  sheet: NUpSheet
): { page: OutputPage; sheetIds: string[] }[] {
  return sheet.slots.flatMap((slot) => {
    if (!slot) return []
    if (slot.kind === "page") return [{ page: slot, sheetIds: [sheet.id] }]
    return sheetIdPaths(slot).map((nestedPage) => ({
      ...nestedPage,
      sheetIds: [sheet.id, ...nestedPage.sheetIds],
    }))
  })
}

/**
 * 面の各ページが出力用紙のどこに来るか（葉ごとの置き場所と用紙）。
 *
 * 配置は出力と同じ `layoutNestedSheet` で、ページの寸法から決める。寸法にはサムネイル
 * 画像の寸法を使う。サムネイルは元PDFを /Rotate ごと描いたものなので、PNG出力（同じ
 * 画像で組む）とは寸法が、PDF出力（元ページで組む）とは縦横比が一致する。
 *
 * サムネイルの無いページ・読めなかったページは、PNG出力と同じく空きスロットとして
 * 格子を選び、そのページの置き場所は無い。読み込み中のページが1枚でもあれば null
 * （図を出さない）。推測で出すと読み込みの後で図や格子の向きが変わって見え、誤った
 * 位置を一瞬示すことになる。読み込みは data URL なので待つのは一瞬で、その間も
 * バッジの番号は出ている。
 */
function measuredSheetLayout(
  sheet: NUpSheet,
  thumbnailSizes: ReadonlyMap<string, NUpSize | null>
) {
  const isMeasuring = sheetLeafPages(sheet).some(
    (page) => page.thumbnail !== "" && !thumbnailSizes.has(page.id)
  )
  if (isMeasuring) return null

  return layoutNestedSheet(
    toLayoutSheet(sheet, (page) => thumbnailSizes.get(page.id) ?? null),
    A4_PAPER
  )
}

/** 段・列の呼び名（3 までは「上・中・下」「左・中央・右」で呼ぶ） */
const ROW_NAMES = new Map([
  [2, ["上", "下"]],
  [3, ["上", "中", "下"]],
])
const COLUMN_NAMES = new Map([
  [2, ["左", "右"]],
  [3, ["左", "中央", "右"]],
])

/**
 * マスの位置を読み上げられる言葉にする（「2×2 の右上」「3×3 の中段の中央」
 * 「2×4 の下段の左から3列目」など）
 */
export function describeSheetCell(cell: SheetCellPosition): string {
  const rowName = ROW_NAMES.get(cell.rows)?.[cell.row]
  const columnName =
    COLUMN_NAMES.get(cell.columns)?.[cell.column] ??
    `左から${cell.column + 1}列目`
  // 2×2 は4つとも角なので「右上」のように呼ぶ。それ以外は「上段の左」のように段から言う
  const position =
    cell.rows === 1
      ? columnName
      : rowName === undefined
        ? `上から${cell.row + 1}段目の${columnName}`
        : cell.columns === 1
          ? rowName
          : cell.rows === 2 && cell.columns === 2
            ? `${columnName}${rowName}`
            : `${rowName}段の${columnName}`
  return `${cell.rows}×${cell.columns} の${position}`
}

/** 入れ子のマスを外側から順に言う（「1×2 の左、その中の 2×1 の下」） */
export function describeCellPath(cellPath: SheetCellPosition[]): string {
  return cellPath.map(describeSheetCell).join("、その中の ")
}

/**
 * バッジに出す番号。面に入るページは「ページ-何枚目」（読む順。全体の面に入った
 * ファイルごとの面も通して数える）、面に入らないページは出力のページ番号だけ
 */
export function placementLabel(placement: PagePlacement): string {
  return placement.slotNumber === undefined
    ? String(placement.outputPageNumber)
    : `${placement.outputPageNumber}-${placement.slotNumber}`
}

/**
 * 出力のどこに入るかを文で言う。カードが狭いと用紙の図を隠すので、図の代わりに
 * バッジの title とカードの aria-label で読めるようにする
 */
export function describePlacement(placement: PagePlacement): string {
  if (placement.slotNumber === undefined) {
    return `出力${placement.outputPageNumber}ページ目`
  }
  const cellDescription = placement.cellPath
    ? `（${describeCellPath(placement.cellPath)}）`
    : ""
  return `出力${placement.outputPageNumber}ページ目の${placement.slotNumber}番目${cellDescription}`
}
