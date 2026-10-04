/**
 * 大問1つの配置。
 *
 * 大問番号ラベルを置き、小問の並べ方（横配置のグリッドか縦配置か）で振り分ける。
 * 単一ページ・複数ページのどちらもここを通る。
 */

import type { MajorQuestion } from "@/types/answerSheetDefinition.types"

import { computeMajorHeight } from "./cellBuilder"
import { isGridHorizontal } from "./gridBuilder"
import { layoutGridMajor } from "./gridMajorLayout"
import type {
  ColumnBounds,
  LayoutColumnSink,
  LayoutPageSink,
  MajorLayoutContext,
} from "./types"
import { layoutVerticalMajor } from "./verticalMajorLayout"

/** 大問を段の中に置き、大問の下端の Y を返す */
export function layoutMajorQuestion(
  context: MajorLayoutContext,
  page: LayoutPageSink,
  column: LayoutColumnSink,
  bounds: ColumnBounds,
  major: MajorQuestion,
  majorIndex: number,
  startY: number,
  pageIndex: number
): number {
  const { settings, majorNumWidth, subNumWidth, branchNumWidth } = context
  const { baseRowHeight } = settings
  const horizontalAreaX = bounds.majorNumX + majorNumWidth
  const horizontalAreaWidth = bounds.contentRight - horizontalAreaX
  const majorHeight = computeMajorHeight(
    major,
    baseRowHeight,
    horizontalAreaWidth,
    subNumWidth,
    branchNumWidth
  )

  // 大問番号ラベル
  page.numberLabels.push({
    text: major.label,
    x: bounds.majorNumX,
    y: startY,
    width: majorNumWidth,
    height:
      settings.numberDisplayMode === "multirow" ? majorHeight : baseRowHeight,
    fontSize: settings.fonts.majorNumberSize,
    displayMode: settings.numberDisplayMode,
  })

  const placement = {
    major,
    majorIndex,
    startY,
    pageIndex,
    bounds,
    horizontalAreaX,
    horizontalAreaWidth,
  }
  return isGridHorizontal(major.subQuestions)
    ? layoutGridMajor(context, placement, page, column)
    : layoutVerticalMajor(context, placement, page, column)
}
