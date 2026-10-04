/**
 * 単一ページレイアウト計算
 *
 * AnswerSheetDefinition → ComputedLayout への変換を行う。
 * 全大問を1ページに収めるレイアウトを計算する。
 */

import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"
import type { ComputedLayout } from "@/types/answerSheetLayout.types"

import { computeMultiPageLayoutFromDefinition } from "./computeMultiPageLayout"
import { getLineWidth } from "./layoutUtils"
import { layoutMajorQuestion } from "./majorLayout"
import { addNumberColumnLines } from "./numberColumnLines"
import { computeOMRMarkers } from "./omrMarkers"
import { addSteppedBorderLines } from "./outerBorderLines"
import { computePageGeometry } from "./pageGeometry"
import type {
  ColumnBounds,
  LayoutColumnSink,
  LayoutPageSink,
  MajorLayoutRange,
} from "./types"
import { transformLayoutToVertical } from "./verticalTransform"

/** AnswerSheetDefinition から単一ページの ComputedLayout を計算する */
export function computeLayoutFromDefinition(
  definition: AnswerSheetDefinition
): ComputedLayout {
  const vertical = definition.settings.verticalLayout ?? false
  const settings = definition.settings

  // 段組みが有効な場合はマルチページレイアウトに委譲
  // （縦書きでは論理の左右段が transpose により上下段になる）
  if (settings.multiColumn.enabled && settings.multiColumn.columnCount > 1) {
    const multiPage = computeMultiPageLayoutFromDefinition(definition)
    const page = multiPage.pages[0]
    if (!page) {
      return {
        pageWidthMm: multiPage.pageWidthMm,
        pageHeightMm: multiPage.pageHeightMm,
        cells: [],
        lines: [],
        numberLabels: [],
        omrMarkerPositions: [],
        headerFields: [],
        overflow: false,
        contentHeightMm: 0,
        vertical,
      }
    }
    return {
      pageWidthMm: multiPage.pageWidthMm,
      pageHeightMm: multiPage.pageHeightMm,
      cells: page.cells,
      lines: page.lines,
      numberLabels: page.numberLabels,
      omrMarkerPositions: page.omrMarkerPositions,
      headerFields: page.headerFields,
      overflow: multiPage.totalPages > 1,
      contentHeightMm: page.contentHeightMm,
      vertical: page.vertical,
    }
  }

  const { majorQuestions } = definition
  const { margins, spacing } = settings
  const {
    realPaper,
    paper,
    contentLeft,
    contentRight,
    contentTop,
    headerFields,
    majorNumWidth,
    subNumWidth,
    branchNumWidth,
    hasBranch,
  } = computePageGeometry(definition)

  const bounds: ColumnBounds = {
    contentLeft,
    contentRight,
    majorNumX: contentLeft,
    subNumX: contentLeft + majorNumWidth,
  }
  const context = {
    settings,
    paper,
    majorNumWidth,
    subNumWidth,
    branchNumWidth,
    // 単一ページのプレビューでは罫線をつまんで寸法を変えられる
    withDragInfo: true,
  }
  const page: LayoutPageSink = { cells: [], lines: [], numberLabels: [] }
  const column: LayoutColumnSink = {
    rowRightEdges: [],
    rowLeftEdges: [],
    verticalRanges: [],
    branchVerticalRanges: [],
    horizontalMajorRanges: [],
  }
  const { lines } = page

  // 大問ごとのレイアウト範囲を追跡（外枠描画用）
  const majorLayoutRanges: MajorLayoutRange[] = []

  let currentY = contentTop

  majorQuestions.forEach((major, majorIndex) => {
    if (majorIndex > 0) {
      currentY += spacing.majorQuestionSpacing
    }

    const majorStartY = currentY
    const rightEdgesBefore = column.rowRightEdges.length
    const leftEdgesBefore = column.rowLeftEdges.length

    currentY = layoutMajorQuestion(
      context,
      page,
      column,
      bounds,
      major,
      majorIndex,
      majorStartY,
      0
    )

    majorLayoutRanges.push({
      startY: majorStartY,
      endY: currentY,
      rowRightEdges: column.rowRightEdges.slice(rightEdgesBefore),
      rowLeftEdges: column.rowLeftEdges.slice(leftEdgesBefore),
    })

    if (
      spacing.majorQuestionSpacing === 0 &&
      majorIndex < majorQuestions.length - 1
    ) {
      lines.push({
        x1: contentLeft,
        y1: currentY,
        x2: contentRight,
        y2: currentY,
        style: settings.borderConfig.majorDivider,
        lineType: "major",
        strokeWidth: getLineWidth("major", settings.borderConfig),
      })
    }
  })

  const contentBottom = currentY

  // 外枠（ステップ形状対応）
  if (spacing.majorQuestionSpacing > 0 && majorLayoutRanges.length > 1) {
    for (const range of majorLayoutRanges) {
      addSteppedBorderLines(
        lines,
        contentLeft,
        range.startY,
        contentRight,
        range.endY,
        settings.borderConfig.outerBorder,
        settings.borderConfig,
        range.rowRightEdges,
        range.rowLeftEdges
      )
    }
  } else {
    const allRightEdges = majorLayoutRanges.flatMap(
      (range) => range.rowRightEdges
    )
    const allLeftEdges = majorLayoutRanges.flatMap(
      (range) => range.rowLeftEdges
    )
    addSteppedBorderLines(
      lines,
      contentLeft,
      contentTop,
      contentRight,
      contentBottom,
      settings.borderConfig.outerBorder,
      settings.borderConfig,
      allRightEdges,
      allLeftEdges
    )
  }

  addNumberColumnLines(lines, {
    settings,
    majorNumX: bounds.majorNumX,
    subNumX: bounds.subNumX,
    majorNumWidth,
    subNumWidth,
    branchNumWidth,
    hasBranch,
    contentTop,
    contentBottom,
    column,
    majorLayoutRanges,
    withDragInfo: true,
  })

  // 段組み仕切り線
  const mcDividerLine = settings.multiColumn.dividerLine
  if (settings.multiColumn.enabled && mcDividerLine) {
    const multiColumn = settings.multiColumn
    const singleColumnWidth =
      (contentRight -
        contentLeft -
        (multiColumn.columnCount - 1) * multiColumn.columnGapMm) /
      multiColumn.columnCount
    for (
      let columnIndex = 1;
      columnIndex < multiColumn.columnCount;
      columnIndex++
    ) {
      const dividerX =
        contentLeft +
        columnIndex * singleColumnWidth +
        (columnIndex - 0.5) * multiColumn.columnGapMm
      lines.push({
        x1: dividerX,
        y1: contentTop,
        x2: dividerX,
        y2: contentBottom,
        style: mcDividerLine,
        lineType: "columnDivider",
        strokeWidth: multiColumn.dividerLineWidth,
      })
    }
  }

  // OMRマーカー
  const omrMarkerPositions = computeOMRMarkers(settings, paper)

  const layout: ComputedLayout = {
    pageWidthMm: paper.width,
    pageHeightMm: paper.height,
    cells: page.cells,
    lines,
    numberLabels: page.numberLabels,
    omrMarkerPositions,
    headerFields,
    overflow: contentBottom > paper.height - margins.bottom,
    contentHeightMm: contentBottom - margins.top,
  }

  return vertical
    ? transformLayoutToVertical(layout, realPaper.width, realPaper.height)
    : layout
}
