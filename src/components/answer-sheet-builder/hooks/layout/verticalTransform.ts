/**
 * 縦組み（右→左）座標変換
 *
 * レイアウト計算は常に「論理（横組み）座標」で行い、用紙全体を縦組みにする場合は
 * その出力（ComputedLayout / ComputedPageLayout）を本モジュールで一括変換する。
 *
 * 変換の定義（論理座標 → 実座標、実用紙幅 W・高さ H）:
 *   - 横組みの Y軸（上→下）→ 縦組みの X軸（右→左にミラー）
 *   - 横組みの X軸（左→右）→ 縦組みの Y軸（上→下）
 *
 * 点:  x' = W - y,           y' = x
 * 矩形: x' = W - (y + h),     y' = x,   w' = h,   h' = w
 *
 * 注: 論理座標は「幅と高さを入れ替えた仮想ページ (LW=H, LH=W)」で計算される前提
 * （呼び出し側で getPaperDimensions の戻りを入れ替えてから compute する）。
 * これにより論理 x∈[0,LW=H]→実 y∈[0,H]、論理 y∈[0,LH=W]→実 x∈[0,W] に正しく収まる。
 */

import type {
  ComputedCell,
  ComputedHeaderField,
  ComputedLayout,
  ComputedLine,
  ComputedNumberLabel,
  ComputedOMRMarker,
  ComputedPageLayout,
  ManuscriptGrid,
} from "@/types/answerSheetLayout.types"
import type { ComputedOMRBubble, ComputedOMRDigitBox } from "@/types/omr.types"

/** 点 (x, y) を縦組み実座標へ変換する */
export function transposePoint(
  x: number,
  y: number,
  realWidth: number
): { x: number; y: number } {
  return { x: realWidth - y, y: x }
}

/** 矩形 (x, y, w, h) を縦組み実座標へ変換する（幅高さも入れ替わる） */
export function transposeRect(
  x: number,
  y: number,
  w: number,
  h: number,
  realWidth: number
): { x: number; y: number; w: number; h: number } {
  return { x: realWidth - (y + h), y: x, w: h, h: w }
}

/**
 * 原稿用紙グリッドを縦組みへ変換する。
 *
 * 矩形（原点・幅高さ）を transpose した上で columns↔rows を入れ替え vertical=true にする。
 * これによりレンダラの縦書き写像（manuscriptCharPosition）とグリッド線描画が、
 * 「論理（横組み）レイアウトの transpose」と完全に一致する（数式検証済み）。
 */
function transposeManuscriptGrid(
  g: ManuscriptGrid,
  realWidth: number
): ManuscriptGrid {
  const r = transposeRect(
    g.gridX,
    g.gridY,
    g.gridWidth,
    g.gridHeight,
    realWidth
  )
  // 罫線スタイルは方向セマンティック（字間／行間）でレンダラが vertical を見て
  // 行/列ループに割り当てるため転置不要。ガイドは atChar 基準で方向非依存。
  return {
    ...g,
    columns: g.rows,
    rows: g.columns,
    gridX: r.x,
    gridY: r.y,
    gridWidth: r.w,
    gridHeight: r.h,
    vertical: true,
  }
}

/** OMRバブル（正規化座標）を縦組みへ変換する。中心は点変換、幅高さは入れ替え */
function transposeBubble(b: ComputedOMRBubble): ComputedOMRBubble {
  return {
    ...b,
    normalizedCx: 1 - b.normalizedCy,
    normalizedCy: b.normalizedCx,
    normalizedWidth: b.normalizedHeight,
    normalizedHeight: b.normalizedWidth,
  }
}

/** OMR数字欄（正規化矩形）を縦組みへ変換する */
function transposeDigitBox(d: ComputedOMRDigitBox): ComputedOMRDigitBox {
  return {
    ...d,
    normalizedX: 1 - (d.normalizedY + d.normalizedH),
    normalizedY: d.normalizedX,
    normalizedW: d.normalizedH,
    normalizedH: d.normalizedW,
  }
}

function transposeCell(
  cell: ComputedCell,
  realWidth: number,
  realHeight: number
): ComputedCell {
  const r = transposeRect(cell.x, cell.y, cell.width, cell.height, realWidth)
  return {
    ...cell,
    x: r.x,
    y: r.y,
    width: r.w,
    height: r.h,
    normalizedX: r.x / realWidth,
    normalizedY: r.y / realHeight,
    normalizedW: r.w / realWidth,
    normalizedH: r.h / realHeight,
    ...(cell.manuscriptGrid
      ? {
          manuscriptGrid: transposeManuscriptGrid(
            cell.manuscriptGrid,
            realWidth
          ),
        }
      : {}),
    ...(cell.omrBubbles
      ? { omrBubbles: cell.omrBubbles.map(transposeBubble) }
      : {}),
    ...(cell.omrDigitBoxes
      ? { omrDigitBoxes: cell.omrDigitBoxes.map(transposeDigitBox) }
      : {}),
  }
}

function transposeLine(line: ComputedLine, realWidth: number): ComputedLine {
  const p1 = transposePoint(line.x1, line.y1, realWidth)
  const p2 = transposePoint(line.x2, line.y2, realWidth)
  // dragInfo は軸の意味が変わるため縦組みでは破棄（MVPはドラッグ無効）
  return {
    x1: p1.x,
    y1: p1.y,
    x2: p2.x,
    y2: p2.y,
    style: line.style,
    strokeWidth: line.strokeWidth,
    lineType: line.lineType,
  }
}

function transposeNumberLabel(
  label: ComputedNumberLabel,
  realWidth: number
): ComputedNumberLabel {
  const r = transposeRect(
    label.x,
    label.y,
    label.width,
    label.height,
    realWidth
  )
  return { ...label, x: r.x, y: r.y, width: r.w, height: r.h }
}

function transposeHeaderField(
  field: ComputedHeaderField,
  realWidth: number
): ComputedHeaderField {
  const r = transposeRect(
    field.x,
    field.y,
    field.width,
    field.height,
    realWidth
  )
  return { ...field, x: r.x, y: r.y, width: r.w, height: r.h }
}

function transposeMarker(
  marker: ComputedOMRMarker,
  realWidth: number
): ComputedOMRMarker {
  // マーカーは size を持つ正方形。点変換だと Y軸ミラーで size 分ずれて
  // 用紙外や反対側へ飛ぶため、矩形として変換し四隅アンカーを保つ。
  const r = transposeRect(
    marker.x,
    marker.y,
    marker.size,
    marker.size,
    realWidth
  )
  return { ...marker, x: r.x, y: r.y }
}

/** ページ単位の全要素を縦組み実座標へ変換する */
export function transformPageToVertical(
  page: ComputedPageLayout,
  realWidth: number,
  realHeight: number
): ComputedPageLayout {
  return {
    ...page,
    vertical: true,
    cells: page.cells.map((c) => transposeCell(c, realWidth, realHeight)),
    lines: page.lines.map((l) => transposeLine(l, realWidth)),
    numberLabels: page.numberLabels.map((n) =>
      transposeNumberLabel(n, realWidth)
    ),
    omrMarkerPositions: page.omrMarkerPositions.map((m) =>
      transposeMarker(m, realWidth)
    ),
    headerFields: page.headerFields.map((h) =>
      transposeHeaderField(h, realWidth)
    ),
  }
}

/** 単一ページレイアウトの全要素を縦組み実座標へ変換する */
export function transformLayoutToVertical(
  layout: ComputedLayout,
  realWidth: number,
  realHeight: number
): ComputedLayout {
  return {
    ...layout,
    vertical: true,
    pageWidthMm: realWidth,
    pageHeightMm: realHeight,
    cells: layout.cells.map((c) => transposeCell(c, realWidth, realHeight)),
    lines: layout.lines.map((l) => transposeLine(l, realWidth)),
    numberLabels: layout.numberLabels.map((n) =>
      transposeNumberLabel(n, realWidth)
    ),
    omrMarkerPositions: layout.omrMarkerPositions.map((m) =>
      transposeMarker(m, realWidth)
    ),
    headerFields: layout.headerFields.map((h) =>
      transposeHeaderField(h, realWidth)
    ),
  }
}
