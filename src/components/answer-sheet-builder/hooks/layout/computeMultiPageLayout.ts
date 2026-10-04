/**
 * 複数ページレイアウト計算
 *
 * AnswerSheetDefinition → ComputedMultiPageLayout への変換を行う。
 * 大問単位でのページ分割・段組みレイアウトに対応する。
 */

import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"
import type {
  ComputedMultiPageLayout,
  ComputedPageLayout,
} from "@/types/answerSheetLayout.types"

import { computeMajorHeight } from "./cellBuilder"
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
import { transformPageToVertical } from "./verticalTransform"

/** 段1つぶんに集めたもの */
interface PerColData extends LayoutColumnSink {
  majorLayoutRanges: MajorLayoutRange[]
  contentBottomY: number
}

/** ページ1枚ぶんに集めたもの */
interface PageData extends LayoutPageSink {
  columns: PerColData[]
}

/** AnswerSheetDefinition から複数ページの ComputedMultiPageLayout を計算する */
export function computeMultiPageLayoutFromDefinition(
  definition: AnswerSheetDefinition
): ComputedMultiPageLayout {
  const { settings, majorQuestions } = definition
  const { margins, baseRowHeight, spacing } = settings
  // 縦書きでは論理（横組み）の左右段が、最終段の transpose により上下段になる
  const {
    vertical,
    realPaper,
    paper,
    contentLeft,
    contentRight,
    contentTop,
    contentMaxY,
    headerFields,
    majorNumWidth,
    subNumWidth,
    branchNumWidth,
    hasBranch,
  } = computePageGeometry(definition)

  // ============================
  // 段組み: 各段の座標範囲を計算
  // ============================

  const multiColumn = settings.multiColumn
  const isMultiCol = multiColumn.enabled && multiColumn.columnCount > 1
  const fullContentWidth = contentRight - contentLeft
  const singleColWidth = isMultiCol
    ? (fullContentWidth -
        (multiColumn.columnCount - 1) * multiColumn.columnGapMm) /
      multiColumn.columnCount
    : fullContentWidth
  const columnCount = isMultiCol ? multiColumn.columnCount : 1

  const colBoundsArr: ColumnBounds[] = []
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
    const colLeft = isMultiCol
      ? contentLeft + columnIndex * (singleColWidth + multiColumn.columnGapMm)
      : contentLeft
    const colRight = colLeft + singleColWidth
    colBoundsArr.push({
      contentLeft: colLeft,
      contentRight: colRight,
      majorNumX: colLeft,
      subNumX: colLeft + majorNumWidth,
    })
  }

  // ============================
  // ページデータ構造
  // ============================

  function newPerColData(): PerColData {
    return {
      verticalRanges: [],
      branchVerticalRanges: [],
      horizontalMajorRanges: [],
      rowRightEdges: [],
      rowLeftEdges: [],
      majorLayoutRanges: [],
      contentBottomY: contentTop,
    }
  }

  function newPageData(): PageData {
    return {
      cells: [],
      lines: [],
      numberLabels: [],
      columns: Array.from({ length: columnCount }, () => newPerColData()),
    }
  }

  const pagesData: PageData[] = [newPageData()]
  let currentPageIdx = 0

  const context = {
    settings,
    paper,
    majorNumWidth,
    subNumWidth,
    branchNumWidth,
    // 罫線をつまんで寸法を変えるのは単一ページのプレビューだけ
    withDragInfo: false,
  }

  // ============================
  // 大問を各段・ページに配置
  // ============================

  let currentColIdx = 0
  const colCurrentY: number[] = Array(columnCount).fill(contentTop)

  for (let majorIndex = 0; majorIndex < majorQuestions.length; majorIndex++) {
    const major = majorQuestions[majorIndex]
    const col = colBoundsArr[currentColIdx]
    const colHorizWidth = col.contentRight - col.majorNumX - majorNumWidth
    const majorHeight = computeMajorHeight(
      major,
      baseRowHeight,
      colHorizWidth,
      subNumWidth,
      branchNumWidth
    )
    const spacingHeight =
      colCurrentY[currentColIdx] > contentTop ? spacing.majorQuestionSpacing : 0

    // 現在の段に収まらない場合
    if (
      colCurrentY[currentColIdx] + spacingHeight + majorHeight > contentMaxY &&
      colCurrentY[currentColIdx] > contentTop
    ) {
      // 現在の段のcontentBottomYを確定
      pagesData[currentPageIdx].columns[currentColIdx].contentBottomY =
        colCurrentY[currentColIdx]

      // 次の段を試す
      currentColIdx++
      if (currentColIdx >= columnCount) {
        // 全段が満杯 → 新ページ
        // 残りの段のcontentBottomYも確定
        for (
          let columnIndex = currentColIdx;
          columnIndex < columnCount;
          columnIndex++
        ) {
          if (colCurrentY[columnIndex] > contentTop) {
            pagesData[currentPageIdx].columns[columnIndex].contentBottomY =
              colCurrentY[columnIndex]
          }
        }
        currentPageIdx++
        pagesData.push(newPageData())
        currentColIdx = 0
        colCurrentY.fill(contentTop)
      }
      // 段が変わっても以降は colBoundsArr[currentColIdx] を直接参照するため、
      // col / colHorizWidth の付け替えは不要（読まれない）
    }

    // スペーシング
    if (colCurrentY[currentColIdx] > contentTop) {
      colCurrentY[currentColIdx] += spacing.majorQuestionSpacing
    }

    const majorStartY = colCurrentY[currentColIdx]
    const page = pagesData[currentPageIdx]
    const colData = page.columns[currentColIdx]
    const rightEdgesBefore = colData.rowRightEdges.length
    const leftEdgesBefore = colData.rowLeftEdges.length

    colCurrentY[currentColIdx] = layoutMajorQuestion(
      context,
      page,
      colData,
      colBoundsArr[currentColIdx],
      major,
      majorIndex,
      colCurrentY[currentColIdx],
      currentPageIdx
    )

    colData.majorLayoutRanges.push({
      startY: majorStartY,
      endY: colCurrentY[currentColIdx],
      rowRightEdges: colData.rowRightEdges.slice(rightEdgesBefore),
      rowLeftEdges: colData.rowLeftEdges.slice(leftEdgesBefore),
    })

    // 大問間の区切り線（majorQuestionSpacing === 0 のとき）
    if (
      spacing.majorQuestionSpacing === 0 &&
      majorIndex < majorQuestions.length - 1
    ) {
      page.lines.push({
        x1: colBoundsArr[currentColIdx].contentLeft,
        y1: colCurrentY[currentColIdx],
        x2: colBoundsArr[currentColIdx].contentRight,
        y2: colCurrentY[currentColIdx],
        style: settings.borderConfig.majorDivider,
        lineType: "major",
        strokeWidth: getLineWidth("major", settings.borderConfig),
      })
    }
  }

  // 最終ページの全段のcontentBottomYを確定
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
    if (colCurrentY[columnIndex] > contentTop) {
      pagesData[currentPageIdx].columns[columnIndex].contentBottomY =
        colCurrentY[columnIndex]
    }
  }

  // ============================
  // ページごとに罫線・番号列線・OMRマーカーを追加
  // ============================

  const pages: ComputedPageLayout[] = pagesData.map((pageData, idx) => {
    // 全段のcontentBottomYの最大値
    const pageContentBottom = Math.max(
      contentTop,
      ...pageData.columns.map((column) => column.contentBottomY)
    )

    // 各段の罫線処理
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
      const col = colBoundsArr[columnIndex]
      const colData = pageData.columns[columnIndex]
      if (colData.contentBottomY <= contentTop) continue // この段に内容がない

      const colContentBottom = colData.contentBottomY

      // 段末尾の大問区切り線を削除
      for (
        let lineIndex = pageData.lines.length - 1;
        lineIndex >= 0;
        lineIndex--
      ) {
        const line = pageData.lines[lineIndex]
        if (
          line.lineType === "major" &&
          Math.abs(line.y1 - colContentBottom) < 0.01 &&
          Math.abs(line.x1 - col.contentLeft) < 0.01
        ) {
          pageData.lines.splice(lineIndex, 1)
          break
        }
      }

      // 外枠線（ステップ形状対応）
      if (
        spacing.majorQuestionSpacing > 0 &&
        colData.majorLayoutRanges.length > 1
      ) {
        for (const range of colData.majorLayoutRanges) {
          addSteppedBorderLines(
            pageData.lines,
            col.contentLeft,
            range.startY,
            col.contentRight,
            range.endY,
            settings.borderConfig.outerBorder,
            settings.borderConfig,
            range.rowRightEdges,
            range.rowLeftEdges
          )
        }
      } else if (colData.majorLayoutRanges.length > 0) {
        addSteppedBorderLines(
          pageData.lines,
          col.contentLeft,
          contentTop,
          col.contentRight,
          colContentBottom,
          settings.borderConfig.outerBorder,
          settings.borderConfig,
          colData.rowRightEdges,
          colData.rowLeftEdges
        )
      }

      addNumberColumnLines(pageData.lines, {
        settings,
        majorNumX: col.majorNumX,
        subNumX: col.subNumX,
        majorNumWidth,
        subNumWidth,
        branchNumWidth,
        hasBranch,
        contentTop,
        contentBottom: colContentBottom,
        column: colData,
        majorLayoutRanges: colData.majorLayoutRanges,
        withDragInfo: false,
      })
    }

    // 段組み仕切り線
    const mcDividerLine = settings.multiColumn.dividerLine
    if (isMultiCol && mcDividerLine) {
      for (let columnIndex = 1; columnIndex < columnCount; columnIndex++) {
        const dividerX =
          contentLeft +
          columnIndex * singleColWidth +
          (columnIndex - 0.5) * multiColumn.columnGapMm
        pageData.lines.push({
          x1: dividerX,
          y1: contentTop,
          x2: dividerX,
          y2: pageContentBottom,
          style: mcDividerLine,
          lineType: "columnDivider",
          strokeWidth: multiColumn.dividerLineWidth,
        })
      }
    }

    const omrMarkerPositions = computeOMRMarkers(settings, paper)

    return {
      pageIndex: idx,
      cells: pageData.cells,
      lines: pageData.lines,
      numberLabels: pageData.numberLabels,
      omrMarkerPositions,
      headerFields,
      contentHeightMm: pageContentBottom - margins.top,
    }
  })

  if (vertical) {
    return {
      pages: pages.map((page) =>
        transformPageToVertical(page, realPaper.width, realPaper.height)
      ),
      totalPages: pages.length,
      pageWidthMm: realPaper.width,
      pageHeightMm: realPaper.height,
    }
  }

  return {
    pages,
    totalPages: pages.length,
    pageWidthMm: paper.width,
    pageHeightMm: paper.height,
  }
}
