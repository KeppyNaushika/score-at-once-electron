/**
 * N-up（1面に複数ページ）の配置の幾何
 *
 * PDF出力(pdf-lib / メインプロセス)とPNG出力(canvas / レンダラー)で
 * 同一のスロット配置を共有するための純粋関数。
 * 座標系は「左上原点・yTopは上端からの距離」で返す。
 * pdf-lib側(左下原点)へは `toPdfDrawing` で変換する。
 *
 * 配置は中身の寸法と回転だけを見る。全体 N-up で面を1スロットへ入れ子にするときは、
 * 内側の面を先に `computeSheetLayout` し、その用紙の寸法を外側の中身の寸法として
 * 渡せば同じ関数で済む。
 */
import type {
  NUpConfig,
  PagesPerSheet,
  RotationDegree,
  SlotOrder,
} from "@/types/pdfTools.types"

export interface NUpSize {
  width: number
  height: number
}

/**
 * N-up の面の用紙: A4（ポイント単位: 1pt = 1/72 inch。縦横は中身から決める）。
 * PDF出力・PNG出力・プレビューの格子が同じ用紙で選ばれるよう、ここに1つだけ置く
 */
export const A4_PAPER: NUpSize = { width: 595.28, height: 841.89 }

/** 左上原点の矩形 */
interface NUpRect {
  x: number
  yTop: number
  width: number
  height: number
}

/** 面の格子（行×列）と用紙 */
interface SheetGrid {
  rows: number
  columns: number
  paper: NUpSize
}

/** スロットに置く中身: 回す前の寸法と、スロットの中で回す角度（時計回り） */
interface SlotItem {
  width: number
  height: number
  rotation: RotationDegree
}

interface SheetLayout extends SheetGrid {
  /**
   * items と同じ並び・同じ長さ。回した後の中身を置く矩形。null は空スロット（描画しない）
   */
  placements: (NUpRect | null)[]
}

/** 1面のページ数ごとに選べる行×列（2・8 は向きを中身の縦横で選ぶ） */
const GRID_SHAPES: Record<PagesPerSheet, { rows: number; columns: number }[]> =
  {
    1: [{ rows: 1, columns: 1 }],
    2: [
      { rows: 1, columns: 2 },
      { rows: 2, columns: 1 },
    ],
    4: [{ rows: 2, columns: 2 }],
    8: [
      { rows: 2, columns: 4 },
      { rows: 4, columns: 2 },
    ],
    9: [{ rows: 3, columns: 3 }],
    16: [{ rows: 4, columns: 4 }],
  }

/** 回した後の寸法（90°・270°で幅と高さが入れ替わる） */
export function rotatedSize(size: NUpSize, rotation: RotationDegree): NUpSize {
  return rotation === 90 || rotation === 270
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height }
}

/**
 * 面の中の k 番目（0始まり）のスロットが、格子のどこ（行・列）に来るか。
 * 並べ方は「どの角から、どちら向きに埋めるか」。
 */
export function slotPosition(
  slotIndex: number,
  grid: { rows: number; columns: number },
  slotOrder: SlotOrder
): { row: number; column: number } {
  switch (slotOrder) {
    case "from-top-left-rightward":
      return {
        row: Math.floor(slotIndex / grid.columns),
        column: slotIndex % grid.columns,
      }
    case "from-top-left-downward":
      return {
        row: slotIndex % grid.rows,
        column: Math.floor(slotIndex / grid.rows),
      }
    case "from-top-right-leftward":
      return {
        row: Math.floor(slotIndex / grid.columns),
        column: grid.columns - 1 - (slotIndex % grid.columns),
      }
    case "from-top-right-downward":
      return {
        row: slotIndex % grid.rows,
        column: grid.columns - 1 - Math.floor(slotIndex / grid.rows),
      }
  }
}

/** 中身を縦横比を保ってスロットに収め、中央に寄せた矩形 */
export function fitInSlot(content: NUpSize, slot: NUpRect): NUpRect {
  const scale = Math.min(
    slot.width / content.width,
    slot.height / content.height
  )
  const width = content.width * scale
  const height = content.height * scale
  return {
    x: slot.x + (slot.width - width) / 2,
    yTop: slot.yTop + (slot.height - height) / 2,
    width,
    height,
  }
}

/**
 * 格子のスロット矩形（行・列で引く）。
 */
function slotRect(
  grid: SheetGrid,
  position: { row: number; column: number }
): NUpRect {
  const slotWidth = grid.paper.width / grid.columns
  const slotHeight = grid.paper.height / grid.rows
  return {
    x: position.column * slotWidth,
    yTop: position.row * slotHeight,
    width: slotWidth,
    height: slotHeight,
  }
}

/** 収めた中身の面積の合計（格子の候補を比べる物差し） */
function placedArea(grid: SheetGrid, contents: (NUpSize | null)[]): number {
  const slot = slotRect(grid, { row: 0, column: 0 })
  return contents.reduce((acc, content) => {
    if (!content) return acc
    const placement = fitInSlot(content, slot)
    return acc + placement.width * placement.height
  }, 0)
}

/**
 * 1面のページ数と中身（回した後の寸法）から、行×列と用紙の縦横を決める。
 *
 * 候補（そのページ数で選べる行×列 × 用紙の縦・横）のうち、中身が最も大きく収まる
 * もの（収めた面積の合計が最大）を選ぶ。縦長のページ2枚なら用紙横で左右に、横長なら
 * 用紙縦で上下に並ぶ。中身が正方形などで同じ大きさになるときは、列の多い格子は用紙横・
 * 行の多い格子と正方の格子は用紙縦を先に取る。
 *
 * @param paper 用紙（向きは問わない。縦横はここで決める）
 */
export function chooseSheetGrid(
  pagesPerSheet: PagesPerSheet,
  contents: (NUpSize | null)[],
  paper: NUpSize
): SheetGrid {
  const portrait = {
    width: Math.min(paper.width, paper.height),
    height: Math.max(paper.width, paper.height),
  }
  const landscape = { width: portrait.height, height: portrait.width }
  const naturalCandidates: SheetGrid[] = []
  const otherCandidates: SheetGrid[] = []
  for (const shape of GRID_SHAPES[pagesPerSheet]) {
    const isWide = shape.columns > shape.rows
    naturalCandidates.push({ ...shape, paper: isWide ? landscape : portrait })
    otherCandidates.push({ ...shape, paper: isWide ? portrait : landscape })
  }
  const candidates = [...naturalCandidates, ...otherCandidates]

  // 浮動小数の誤差で、同じ大きさの候補が後ろのものに入れ替わらないようにする
  const tolerance = 1e-9
  return candidates.reduce((best, candidate) => {
    const bestArea = placedArea(best, contents)
    return placedArea(candidate, contents) > bestArea * (1 + tolerance)
      ? candidate
      : best
  })
}

/**
 * 1面の配置を計算する: 格子を選び、各スロットに回した後の中身を縦横比を保って
 * 中央に収める。
 *
 * スロット位置は配列インデックスで固定されるため、途中のページが欠損しても
 * 残りのページが別スロットへずれることはない（null を渡せば空スロットになる）。
 *
 * @param items 並べ方の順の中身。null は空スロット
 * @param paper 用紙（A4など。向きは中身から決める）
 */
export function computeSheetLayout(
  nUp: NUpConfig,
  items: (SlotItem | null)[],
  paper: NUpSize
): SheetLayout {
  const contents = items.map((item) =>
    item ? rotatedSize(item, item.rotation) : null
  )
  const grid = chooseSheetGrid(nUp.pagesPerSheet, contents, paper)
  const placements = contents.map((content, slotIndex) =>
    content
      ? fitInSlot(
          content,
          slotRect(grid, slotPosition(slotIndex, grid, nUp.slotOrder))
        )
      : null
  )
  return { ...grid, placements }
}

/**
 * 左上原点の配置矩形（回した後の中身の外形）を、pdf-lib の drawPage の引数へ直す。
 *
 * drawPage は左下原点で、(x, y) を中心に反時計回りに rotate してから幅×高さで描く。
 * 時計回りに回すので回転は負にし、回した後の外形が矩形にちょうど重なるよう、
 * 原点を矩形の角へずらす。width・height は回す前の向きでの寸法。
 */
export function toPdfDrawing(
  placement: NUpRect,
  rotation: RotationDegree,
  paperHeight: number
): {
  x: number
  y: number
  width: number
  height: number
  counterClockwiseDegrees: number
} {
  const left = placement.x
  const bottom = paperHeight - (placement.yTop + placement.height)
  const unrotated = rotatedSize(placement, rotation)
  const origin = {
    0: { x: left, y: bottom },
    90: { x: left, y: bottom + placement.height },
    180: { x: left + placement.width, y: bottom + placement.height },
    270: { x: left + placement.width, y: bottom },
  }[rotation]
  return {
    ...origin,
    ...unrotated,
    counterClockwiseDegrees: rotation === 0 ? 0 : -rotation,
  }
}

/** 任意の角度（元PDFの /Rotate を足したもの等）を 0/90/180/270 へ正規化する */
export function normalizeRotation(angle: number): RotationDegree {
  const normalized = (((Math.round(angle / 90) * 90) % 360) + 360) % 360
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized
  }
  return 0
}
