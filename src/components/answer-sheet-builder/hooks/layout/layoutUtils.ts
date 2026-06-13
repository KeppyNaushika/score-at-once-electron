/**
 * レイアウト計算のユーティリティ関数
 *
 * 用紙サイズ取得・線幅取得・範囲クリップなど、
 * レイアウト計算全体で共通利用する低レベルヘルパー。
 */

import type {
  BorderConfig,
  GlobalSettings,
} from "@/types/answerSheetDefinition.types"

import {
  DEFAULT_DASH_RATIO,
  DEFAULT_GAP_RATIO,
  PAPER_SIZES,
} from "../../constants"

/** lineType から BorderConfig の線幅を取得するヘルパー */
export function getLineWidth(
  lineType: string,
  borderConfig: BorderConfig
): number {
  switch (lineType) {
    case "outer":
      return borderConfig.outerBorderWidth ?? 0.7
    case "major":
      return borderConfig.majorDividerWidth ?? 0.5
    case "sub":
    case "subHorizontalDivider":
      return borderConfig.subDividerWidth ?? 0.4
    case "branch":
      return borderConfig.branchDividerWidth ?? 0.3
    case "majorNumberColumn":
      return borderConfig.majorNumberDividerWidth ?? 0.4
    case "subNumberColumn":
      return borderConfig.subNumberDividerWidth ?? 0.4
    case "branchNumberColumn":
      return borderConfig.branchNumberDividerWidth ?? 0.3
    default:
      return 0.4
  }
}

/**
 * lineType から破線/点線のダッシュ長・間隔倍率（線幅に対する倍率）を取得する。
 * 罫線種別ごとに BorderConfig で個別設定でき、未指定時は既定値を返す。
 */
export function getLineDashRatio(
  lineType: string,
  borderConfig: BorderConfig
): { dashRatio: number; gapRatio: number } {
  const pick = (
    dash: number | undefined,
    gap: number | undefined
  ): { dashRatio: number; gapRatio: number } => ({
    dashRatio: dash ?? DEFAULT_DASH_RATIO,
    gapRatio: gap ?? DEFAULT_GAP_RATIO,
  })
  switch (lineType) {
    case "outer":
      return pick(
        borderConfig.outerBorderDashRatio,
        borderConfig.outerBorderGapRatio
      )
    case "major":
      return pick(
        borderConfig.majorDividerDashRatio,
        borderConfig.majorDividerGapRatio
      )
    case "sub":
    case "subHorizontalDivider":
      return pick(
        borderConfig.subDividerDashRatio,
        borderConfig.subDividerGapRatio
      )
    case "branch":
      return pick(
        borderConfig.branchDividerDashRatio,
        borderConfig.branchDividerGapRatio
      )
    case "majorNumberColumn":
      return pick(
        borderConfig.majorNumberDividerDashRatio,
        borderConfig.majorNumberDividerGapRatio
      )
    case "subNumberColumn":
      return pick(
        borderConfig.subNumberDividerDashRatio,
        borderConfig.subNumberDividerGapRatio
      )
    case "branchNumberColumn":
      return pick(
        borderConfig.branchNumberDividerDashRatio,
        borderConfig.branchNumberDividerGapRatio
      )
    default:
      return pick(undefined, undefined)
  }
}

/** GlobalSettings から用紙の幅・高さ（mm）を取得する */
export function getPaperDimensions(settings: GlobalSettings) {
  const base = PAPER_SIZES[settings.paperSize] ?? PAPER_SIZES.A4
  if (settings.orientation === "landscape") {
    return { width: base.height, height: base.width }
  }
  return { width: base.width, height: base.height }
}

/**
 * 縦線の範囲を大問レイアウト範囲内にクリップする。
 * majorQuestionSpacing > 0 の場合に大問間のギャップを跨がないようにする。
 */
export function clipRangeToMajorLayouts(
  range: { top: number; bottom: number },
  majorLayouts: Array<{ startY: number; endY: number }>
): Array<{ top: number; bottom: number }> {
  if (majorLayouts.length === 0) return [range]
  const result: Array<{ top: number; bottom: number }> = []
  for (const ml of majorLayouts) {
    const top = Math.max(range.top, ml.startY)
    const bottom = Math.min(range.bottom, ml.endY)
    if (top < bottom - 0.01) {
      result.push({ top, bottom })
    }
  }
  return result.length > 0 ? result : [range]
}

/**
 * 原稿用紙でN文字目（0-indexed）が入るマス位置 (col, row) を返す。
 * グリッド外（マス数を超える）の場合は null。
 *
 * - 横書き: 左→右、行は上→下。 col = i % columns, row = floor(i / columns)
 * - 縦書き: 上→下、列は右→左。 row = i % rows, col = (columns-1) - floor(i / rows)
 *
 * col/row はいずれも 0-indexed。cx/cy 中心座標の計算式は方向に依らず共通
 * （gridX + col*cellSize + cellSize/2 等）。
 */
export function manuscriptCharPosition(
  index: number,
  columns: number,
  rows: number,
  vertical: boolean
): { col: number; row: number } | null {
  if (vertical) {
    const row = index % rows
    const colFromRight = Math.floor(index / rows)
    if (colFromRight >= columns) return null
    return { col: columns - 1 - colFromRight, row }
  }
  const col = index % columns
  const row = Math.floor(index / columns)
  if (row >= rows) return null
  return { col, row }
}

/** 分数文字列 (e.g. "1/4", "3/4") を 0〜1 の数値に変換 */
export function parseFraction(s: string): number {
  const m = s.match(/^(\d+)\/(\d+)$/)
  if (m) return parseInt(m[1]) / parseInt(m[2])
  const n = parseFloat(s)
  return isNaN(n) ? 1 : n
}
