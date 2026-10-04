/**
 * 横配置（グリッド）の大問の配置。
 *
 * 小問を幅の分数（`layoutWidth`）でグリッドに並べ、セル・番号ラベル・区切り線と、
 * 大問番号の独立した枠を描く。
 */

import { renderBranchQuestions } from "./branchRenderer"
import { computeManuscriptGrid, createCell } from "./cellBuilder"
import {
  buildBranchGridLayout,
  buildSubGridLayout,
  computeGridRowLeftEdges,
  computeGridRowRightEdges,
  gridTotalHeight,
  isGridHorizontal,
  mergeAbsoluteRightEdges,
} from "./gridBuilder"
import {
  renderGridCompletionLines,
  renderGridDividerLines,
} from "./gridDividerLines"
import { getLineWidth } from "./layoutUtils"
import { availableBranchAreaWidth } from "./manuscriptWidth"
import type {
  LayoutColumnSink,
  LayoutPageSink,
  MajorLayoutContext,
  MajorPlacement,
  RowRightEdge,
} from "./types"

/** 横配置の大問を置き、大問の下端の Y を返す */
export function layoutGridMajor(
  context: MajorLayoutContext,
  placement: MajorPlacement,
  page: LayoutPageSink,
  column: LayoutColumnSink
): number {
  const { settings, paper, subNumWidth, branchNumWidth } = context
  const { baseRowHeight } = settings
  const {
    major,
    majorIndex,
    startY: majorStartY,
    pageIndex,
    bounds,
    horizontalAreaX,
    horizontalAreaWidth,
  } = placement

  // 原稿用紙セルの layoutWidth はグリッドの中で必要幅に合う
  const gridCells = buildSubGridLayout(
    major.subQuestions,
    baseRowHeight,
    horizontalAreaWidth,
    subNumWidth,
    branchNumWidth
  )
  const rightEdgesStart = column.rowRightEdges.length
  const leftEdgesStart = column.rowLeftEdges.length
  for (const gridCell of gridCells) {
    const cellX = horizontalAreaX + gridCell.x * horizontalAreaWidth
    const cellWidth = gridCell.width * horizontalAreaWidth
    const cellY = majorStartY + gridCell.y * baseRowHeight
    const cellHeight = gridCell.height * baseRowHeight
    const sub = gridCell.item
    const hasBranches = sub.branchQuestions.length > 0
    const effSubNumW = sub.label === "" ? 0 : subNumWidth

    if (effSubNumW > 0) {
      page.numberLabels.push({
        text: sub.label,
        x: cellX,
        y: cellY,
        width: effSubNumW,
        height: cellHeight,
        fontSize: settings.fonts.subNumberSize,
        displayMode: "sub-horizontal",
      })
    }

    if (hasBranches) {
      // 枝問をセル内でレンダリング
      const cellBranchNumX = cellX + effSubNumW
      const cellBranchNumWidth = branchNumWidth
      const cellAnswerX = cellBranchNumX + cellBranchNumWidth
      const cellAnswerWidth = cellWidth - effSubNumW - cellBranchNumWidth
      const cellRight = cellX + cellWidth
      renderBranchQuestions(
        sub,
        majorIndex,
        gridCell.itemIndex,
        major.label,
        cellY,
        pageIndex,
        cellX,
        effSubNumW,
        cellBranchNumX,
        cellBranchNumWidth,
        cellAnswerX,
        cellAnswerWidth,
        cellRight,
        availableBranchAreaWidth(sub, horizontalAreaWidth, subNumWidth),
        baseRowHeight,
        paper,
        settings,
        page.cells,
        page.lines,
        page.numberLabels,
        column.rowRightEdges
      )
    } else {
      let ansX = cellX + effSubNumW
      let ansW = cellWidth - effSubNumW
      if (sub.manuscriptPaper?.enabled) {
        const cellSz = cellHeight / sub.manuscriptPaper.rows
        const gridW = cellSz * sub.manuscriptPaper.columns
        ansW = gridW
      }
      page.cells.push(
        createCell(
          [majorIndex, gridCell.itemIndex],
          ansX,
          cellY,
          ansW,
          cellHeight,
          paper,
          `${major.label}-${sub.label}`,
          sub.points,
          sub.textElements,
          "answer",
          pageIndex,
          computeManuscriptGrid(
            sub,
            ansX,
            cellY,
            ansW,
            cellHeight,
            settings.borderConfig
          ),
          sub.omrConfig,
          sub.imageElements
        )
      )
    }

    // 番号ラベル右側の区切り線
    if (effSubNumW > 0) {
      page.lines.push({
        x1: cellX + effSubNumW,
        y1: cellY,
        x2: cellX + effSubNumW,
        y2: cellY + cellHeight,
        style: settings.borderConfig.subNumberDivider,
        lineType: "subNumberColumn",
        strokeWidth: getLineWidth("subNumberColumn", settings.borderConfig),
      })
    }
  }

  // rowRightEdges: Y区間ごとの右端X座標を計算（枝問横配置を考慮）
  const rawRightEdges: RowRightEdge[] = []
  for (const gridCell of gridCells) {
    const subQuestion = gridCell.item
    const gcCellX = horizontalAreaX + gridCell.x * horizontalAreaWidth
    const gcCellW = gridCell.width * horizontalAreaWidth
    const gcCellY = majorStartY + gridCell.y * baseRowHeight
    const gcCellH = gridCell.height * baseRowHeight
    const gcCellRight = gcCellX + gcCellW
    const gcEffSubNumW = subQuestion.label === "" ? 0 : subNumWidth

    if (
      subQuestion.branchQuestions.length > 0 &&
      isGridHorizontal(subQuestion.branchQuestions)
    ) {
      const branchAreaX = gcCellX + gcEffSubNumW
      const branchAreaWidth = gcCellRight - branchAreaX
      const branchCells = buildBranchGridLayout(
        subQuestion.branchQuestions,
        baseRowHeight,
        branchNumWidth,
        availableBranchAreaWidth(subQuestion, horizontalAreaWidth, subNumWidth)
      )
      for (const edge of computeGridRowRightEdges(
        branchCells,
        gcCellY,
        branchAreaX,
        branchAreaWidth,
        baseRowHeight
      )) {
        rawRightEdges.push(edge)
      }
    } else {
      rawRightEdges.push({
        yTop: gcCellY,
        yBottom: gcCellY + gcCellH,
        rightX: gcCellRight,
      })
    }
  }
  for (const edge of mergeAbsoluteRightEdges(rawRightEdges)) {
    column.rowRightEdges.push(edge)
  }

  // rowLeftEdges: Y区間ごとの左端X座標を計算
  for (const edge of computeGridRowLeftEdges(
    gridCells,
    majorStartY,
    horizontalAreaX,
    horizontalAreaWidth,
    baseRowHeight
  )) {
    column.rowLeftEdges.push({
      yTop: edge.yTop,
      yBottom: edge.yBottom,
      leftX: edge.leftX,
    })
  }

  // グリッドセル間の区切り線（隣接セル間の共有辺）
  renderGridDividerLines(
    gridCells,
    majorStartY,
    horizontalAreaX,
    horizontalAreaWidth,
    baseRowHeight,
    settings,
    page.lines,
    "sub"
  )

  const majorEndY = majorStartY + gridTotalHeight(gridCells) * baseRowHeight

  // セルと空白スペースの境界線を補完（枝問横配置を反映したrightEdgesを使用）
  const majorRightEdges = column.rowRightEdges.slice(rightEdgesStart)
  const majorLeftEdges = column.rowLeftEdges.slice(leftEdgesStart)
  renderGridCompletionLines(
    gridCells,
    majorStartY,
    horizontalAreaX,
    horizontalAreaWidth,
    baseRowHeight,
    settings,
    page.lines,
    "sub",
    {
      top: majorStartY,
      bottom: majorEndY,
      rightEdges: majorRightEdges,
      leftEdges: majorLeftEdges,
    }
  )

  // 横配置モード: 大問番号枠を独立した長方形として描画（左辺・右辺・上辺・下辺）
  const outerSw = getLineWidth("outer", settings.borderConfig)
  page.lines.push(
    {
      x1: bounds.contentLeft,
      y1: majorStartY,
      x2: bounds.contentLeft,
      y2: majorEndY,
      style: settings.borderConfig.outerBorder,
      strokeWidth: outerSw,
      lineType: "outer",
    },
    {
      x1: horizontalAreaX,
      y1: majorStartY,
      x2: horizontalAreaX,
      y2: majorEndY,
      style: settings.borderConfig.outerBorder,
      strokeWidth: outerSw,
      lineType: "outer",
    },
    {
      x1: bounds.contentLeft,
      y1: majorStartY,
      x2: horizontalAreaX,
      y2: majorStartY,
      style: settings.borderConfig.outerBorder,
      strokeWidth: outerSw,
      lineType: "outer",
    },
    {
      x1: bounds.contentLeft,
      y1: majorEndY,
      x2: horizontalAreaX,
      y2: majorEndY,
      style: settings.borderConfig.outerBorder,
      strokeWidth: outerSw,
      lineType: "outer",
    }
  )

  column.horizontalMajorRanges.push({
    top: majorStartY,
    bottom: majorEndY,
  })

  return majorEndY
}
