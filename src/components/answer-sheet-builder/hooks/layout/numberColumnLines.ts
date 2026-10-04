/**
 * 番号列（大問・小問・枝問）の縦線。
 *
 * 大問を置き終えてから、段ごとに集めた区間へまとめて引く。大問番号列は横配置の
 * 大問と大問間のすき間を避け、小問・枝問番号列は大問の外枠の中にクリップする。
 */

import type { GlobalSettings } from "@/types/answerSheetDefinition.types"
import type { ComputedLine, DragInfo } from "@/types/answerSheetLayout.types"

import { clipRangeToMajorLayouts, getLineWidth } from "./layoutUtils"
import type { LayoutColumnSink, MajorLayoutRange, VerticalRange } from "./types"

interface NumberColumnLinesInput {
  settings: GlobalSettings
  /** 大問番号列の左端 */
  majorNumX: number
  /** 小問番号列の左端 */
  subNumX: number
  majorNumWidth: number
  subNumWidth: number
  branchNumWidth: number
  hasBranch: boolean
  contentTop: number
  contentBottom: number
  column: LayoutColumnSink
  majorLayoutRanges: MajorLayoutRange[]
  /** 罫線をつまんで列幅を変えられるようにするか（単一ページのプレビューだけ） */
  withDragInfo: boolean
}

/** 列幅を変えるドラッグの手掛かり。付けないときは何も足さない */
function columnWidthDrag(
  withDragInfo: boolean,
  column: Extract<DragInfo["target"], { type: "columnWidth" }>["column"],
  currentValueMm: number
): Pick<ComputedLine, "dragInfo"> {
  if (!withDragInfo) return {}
  return {
    dragInfo: {
      axis: "vertical",
      target: { type: "columnWidth", column },
      currentValueMm,
      minMm: 5,
    },
  }
}

/** 段の番号列の縦線を `lines` に足す */
export function addNumberColumnLines(
  lines: ComputedLine[],
  {
    settings,
    majorNumX,
    subNumX,
    majorNumWidth,
    subNumWidth,
    branchNumWidth,
    hasBranch,
    contentTop,
    contentBottom,
    column,
    majorLayoutRanges,
    withDragInfo,
  }: NumberColumnLinesInput
): void {
  const { spacing, borderConfig } = settings

  // 大問番号列の縦線 → 横配置大問の範囲とスペーシング部分を除外
  // （ドラッグの手掛かりは最初の1本にだけ付ける）
  const majorNcSw = getLineWidth("majorNumberColumn", borderConfig)
  const majorNumLineX = majorNumX + majorNumWidth
  const majorColExcludeRanges: VerticalRange[] = [
    ...column.horizontalMajorRanges,
  ]
  if (spacing.majorQuestionSpacing > 0) {
    for (let i = 0; i < majorLayoutRanges.length - 1; i++) {
      majorColExcludeRanges.push({
        top: majorLayoutRanges[i].endY,
        bottom: majorLayoutRanges[i + 1].startY,
      })
    }
    majorColExcludeRanges.sort((rangeA, rangeB) => rangeA.top - rangeB.top)
  }
  let segStart = contentTop
  let isFirst = true
  for (const range of majorColExcludeRanges) {
    if (segStart < range.top - 0.01) {
      lines.push({
        x1: majorNumLineX,
        y1: segStart,
        x2: majorNumLineX,
        y2: range.top,
        style: borderConfig.majorNumberDivider,
        lineType: "majorNumberColumn",
        strokeWidth: majorNcSw,
        ...(isFirst
          ? columnWidthDrag(withDragInfo, "majorNumber", majorNumWidth)
          : {}),
      })
      isFirst = false
    }
    segStart = range.bottom
  }
  if (segStart < contentBottom - 0.01) {
    lines.push({
      x1: majorNumLineX,
      y1: segStart,
      x2: majorNumLineX,
      y2: contentBottom,
      style: borderConfig.majorNumberDivider,
      lineType: "majorNumberColumn",
      strokeWidth: majorNcSw,
      ...(isFirst
        ? columnWidthDrag(withDragInfo, "majorNumber", majorNumWidth)
        : {}),
    })
  }

  // 小問番号列の縦線 → 縦配置のセグメントのみ（大問外枠内にクリップ）
  const subNcSw = getLineWidth("subNumberColumn", borderConfig)
  for (const range of column.verticalRanges) {
    const clipped = clipRangeToMajorLayouts(range, majorLayoutRanges)
    for (const clippedRange of clipped) {
      lines.push({
        x1: subNumX + subNumWidth,
        y1: clippedRange.top,
        x2: subNumX + subNumWidth,
        y2: clippedRange.bottom,
        style: borderConfig.subNumberDivider,
        lineType: "subNumberColumn",
        strokeWidth: subNcSw,
        ...columnWidthDrag(withDragInfo, "subNumber", subNumWidth),
      })
    }
  }

  // 枝問番号列の縦線 → vertical-branchセグメントのみ（大問外枠内にクリップ）
  if (hasBranch) {
    const branchNcSw = getLineWidth("branchNumberColumn", borderConfig)
    for (const range of column.branchVerticalRanges) {
      const clipped = clipRangeToMajorLayouts(range, majorLayoutRanges)
      for (const clippedRange of clipped) {
        lines.push({
          x1: range.lineX,
          y1: clippedRange.top,
          x2: range.lineX,
          y2: clippedRange.bottom,
          style: borderConfig.branchNumberDivider,
          lineType: "branchNumberColumn",
          strokeWidth: branchNcSw,
          ...columnWidthDrag(withDragInfo, "branchNumber", branchNumWidth),
        })
      }
    }
  }
}
