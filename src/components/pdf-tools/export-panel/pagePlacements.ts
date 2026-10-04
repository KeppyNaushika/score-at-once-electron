import {
  A4_PAPER,
  computeSheetLayout,
  type NUpSize,
  slotPosition,
} from "@/lib/pdf-tools/nUpLayout"
import type { NUpSheet, OutputSheet } from "@/types/pdfTools.types"

/** 面の格子（行×列・用紙の向き）の中で、ページが入るマス */
export interface SheetCell {
  rows: number
  columns: number
  row: number
  column: number
  isLandscape: boolean
}

/** ページが出力のどこに入るか */
export interface PagePlacement {
  /** 出力の何ページ目か（1始まり） */
  outputPageNumber: number
  /** N-up の面に入るときの面の id（面に入らなければ無い） */
  sheetId?: string
  /** 面の中の何番目のスロットか（1始まり。並べ方の順＝読む順） */
  slotNumber?: number
  /** 面の格子のどのマスに入るか（面の全ページの寸法が揃うまでは無い） */
  cell?: SheetCell
}

/**
 * 各ページが出力の何ページ目の、どのスロット（格子のどのマス）に入るか
 * （ページの id → 位置）。
 *
 * @param thumbnailSizes ページの id → サムネイル画像の寸法（回す前）。読み込み中の
 *   ページは入っておらず、読めなかったページは null
 */
export function pagePlacements(
  sheets: OutputSheet[],
  thumbnailSizes: ReadonlyMap<string, NUpSize | null>
): Map<string, PagePlacement> {
  return new Map(
    sheets.flatMap((sheet, sheetIndex) => {
      const outputPageNumber = sheetIndex + 1
      if (sheet.kind === "page") {
        return [[sheet.id, { outputPageNumber }] as const]
      }
      const cells = sheetCells(sheet, thumbnailSizes)
      return sheet.slots.flatMap((slot, slotIndex) =>
        slot
          ? [
              [
                slot.id,
                {
                  outputPageNumber,
                  sheetId: sheet.id,
                  slotNumber: slotIndex + 1,
                  cell: cells?.[slotIndex],
                },
              ] as const,
            ]
          : []
      )
    })
  )
}

/**
 * 面の各スロットが格子のどのマスに来るか（スロットと同じ並び）。
 *
 * 格子（行×列・用紙の向き）は出力と同じ `computeSheetLayout` で、ページの寸法から
 * 決める。寸法にはサムネイル画像の寸法を使う。サムネイルは元PDFを /Rotate ごと
 * 描いたものなので、PNG出力（同じ画像で組む）とは寸法が、PDF出力（元ページで組む）
 * とは縦横比が一致する。
 *
 * サムネイルの無いページ・読めなかったページは、PNG出力と同じく空きスロットとして
 * 格子を選ぶ。読み込み中のページが1枚でもあれば null（図を出さない）。推測で出すと
 * 読み込みの後で塗るマスや格子の向きが変わって見え、誤った位置を一瞬示すことになる。
 * 読み込みは data URL なので待つのは一瞬で、その間もバッジの番号は出ている。
 */
function sheetCells(
  sheet: NUpSheet,
  thumbnailSizes: ReadonlyMap<string, NUpSize | null>
): (SheetCell | undefined)[] | null {
  const isMeasuring = sheet.slots.some(
    (slot) => slot && slot.thumbnail !== "" && !thumbnailSizes.has(slot.id)
  )
  if (isMeasuring) return null

  const layout = computeSheetLayout(
    sheet.nUp,
    sheet.slots.map((slot) => {
      const size = slot ? thumbnailSizes.get(slot.id) : null
      return slot && size ? { ...size, rotation: slot.rotation } : null
    }),
    A4_PAPER
  )
  const isLandscape = layout.paper.width > layout.paper.height
  return sheet.slots.map((_, slotIndex) => ({
    rows: layout.rows,
    columns: layout.columns,
    ...slotPosition(slotIndex, layout, sheet.nUp.slotOrder),
    isLandscape,
  }))
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
export function describeSheetCell(cell: SheetCell): string {
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

/**
 * バッジに出す番号。面に入るページは「ページ-スロット」（スロットは読む順）、
 * 面に入らないページは出力のページ番号だけ
 */
export function placementLabel(placement: PagePlacement): string {
  return placement.sheetId === undefined
    ? String(placement.outputPageNumber)
    : `${placement.outputPageNumber}-${placement.slotNumber}`
}

/**
 * 出力のどこに入るかを文で言う。カードが狭いと格子の図を隠すので、図の代わりに
 * バッジの title とカードの aria-label で読めるようにする
 */
export function describePlacement(placement: PagePlacement): string {
  if (placement.sheetId === undefined) {
    return `出力${placement.outputPageNumber}ページ目`
  }
  const cellDescription = placement.cell
    ? `（${describeSheetCell(placement.cell)}）`
    : ""
  return `出力${placement.outputPageNumber}ページ目の${placement.slotNumber}番目${cellDescription}`
}
