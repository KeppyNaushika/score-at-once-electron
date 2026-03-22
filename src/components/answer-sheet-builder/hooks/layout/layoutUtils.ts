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

import { PAPER_SIZES } from "../../constants"

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

/** 分数文字列 (e.g. "1/4", "3/4") を 0〜1 の数値に変換 */
export function parseFraction(s: string): number {
  const m = s.match(/^(\d+)\/(\d+)$/)
  if (m) return parseInt(m[1]) / parseInt(m[2])
  const n = parseFloat(s)
  return isNaN(n) ? 1 : n
}
