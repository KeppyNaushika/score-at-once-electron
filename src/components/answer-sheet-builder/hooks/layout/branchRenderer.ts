/**
 * 枝問の描画（横配置・縦配置両対応）。
 *
 * 小問の中に枝問のセル・番号ラベル・区切り線を置く。
 */

import type {
  GlobalSettings,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"
import type {
  ComputedCell,
  ComputedLine,
  ComputedNumberLabel,
} from "@/types/answerSheetLayout.types"

import { computeManuscriptGrid, createCell } from "./cellBuilder"
import {
  buildBranchGridLayout,
  computeGridRowRightEdges,
  gridTotalHeight,
  isGridHorizontal,
} from "./gridBuilder"
import {
  renderGridCompletionLines,
  renderGridDividerLines,
} from "./gridDividerLines"
import { getLineWidth } from "./layoutUtils"
import type { RowRightEdge } from "./types"

/** 枝問の描画（横配置・縦配置両対応） */
export function renderBranchQuestions(
  sub: SubQuestion,
  majorIndex: number,
  subIndex: number,
  majorLabel: string,
  subStartY: number,
  pageIndex: number,
  subNumX: number,
  subNumWidth: number,
  branchNumX: number,
  branchNumWidth: number,
  _answerX: number,
  _answerWidth: number,
  contentRight: number,
  /**
   * 枝問領域の、幅を書き換える前の幅（mm）。原稿用紙を持たない枝問の実効幅がこれを
   * 分け合う。`contentRight` は書き換えた**後**の右端なので、そこからは出せない。
   */
  availableBranchAreaWidth: number,
  baseRowHeight: number,
  paper: { width: number; height: number },
  settings: GlobalSettings,
  cells: ComputedCell[],
  lines: ComputedLine[],
  numberLabels: ComputedNumberLabel[],
  _rowRightEdges: RowRightEdge[]
) {
  const branchIsHorizontal = isGridHorizontal(sub.branchQuestions)

  if (branchIsHorizontal) {
    const branchAreaX = subNumX + subNumWidth
    const branchAreaWidth = contentRight - branchAreaX
    const branchCells = buildBranchGridLayout(
      sub.branchQuestions,
      baseRowHeight,
      branchNumWidth,
      availableBranchAreaWidth
    )

    for (const gridCell of branchCells) {
      const cellX = branchAreaX + gridCell.x * branchAreaWidth
      const cellWidth = gridCell.width * branchAreaWidth
      const cellY = subStartY + gridCell.y * baseRowHeight
      const cellHeight = gridCell.height * baseRowHeight
      const effBranchNumW = gridCell.item.label === "" ? 0 : branchNumWidth

      if (effBranchNumW > 0) {
        numberLabels.push({
          text: gridCell.item.label,
          x: cellX,
          y: cellY,
          width: effBranchNumW,
          height: cellHeight,
          fontSize: settings.fonts.branchNumberSize,
          displayMode: "branch-horizontal",
        })
      }

      const branchPoints =
        sub.usesBranchPoints === false ? 0 : gridCell.item.points
      // 原稿用紙のある枝問は、解答欄そのものをマス目の幅にする（小問と同じ）。
      // **枝問は必ずこの横配置の枝を通る** — `isGridHorizontal` が原稿用紙を
      // 横配置の条件に数えているため、縦配置の枝へは落ちてこない
      const branchAnswerX = cellX + effBranchNumW
      const branchManuscriptPaper = gridCell.item.manuscriptPaper
      const branchAnswerWidth = branchManuscriptPaper?.enabled
        ? (cellHeight / branchManuscriptPaper.rows) *
          branchManuscriptPaper.columns
        : cellWidth - effBranchNumW
      cells.push(
        createCell(
          [majorIndex, subIndex, gridCell.itemIndex],
          branchAnswerX,
          cellY,
          branchAnswerWidth,
          cellHeight,
          paper,
          `${majorLabel}-${sub.label}-${gridCell.item.label}`,
          branchPoints,
          gridCell.item.textElements,
          "answer",
          pageIndex,
          computeManuscriptGrid(
            gridCell.item,
            branchAnswerX,
            cellY,
            branchAnswerWidth,
            cellHeight,
            settings.borderConfig
          ),
          gridCell.item.omrConfig,
          gridCell.item.imageElements
        )
      )

      // 番号ラベル右側の区切り線
      if (effBranchNumW > 0) {
        lines.push({
          x1: cellX + effBranchNumW,
          y1: cellY,
          x2: cellX + effBranchNumW,
          y2: cellY + cellHeight,
          style: settings.borderConfig.branchNumberDivider,
          lineType: "branchNumberColumn",
          strokeWidth: getLineWidth(
            "branchNumberColumn",
            settings.borderConfig
          ),
        })
      }
    }

    // グリッドセル間の区切り線
    renderGridDividerLines(
      branchCells,
      subStartY,
      branchAreaX,
      branchAreaWidth,
      baseRowHeight,
      settings,
      lines,
      "branch"
    )

    // セルと空白スペースの境界線を補完（枝問グリッドの実際の右端を使用）
    const subBottom = subStartY + gridTotalHeight(branchCells) * baseRowHeight
    const branchRightEdges = computeGridRowRightEdges(
      branchCells,
      subStartY,
      branchAreaX,
      branchAreaWidth,
      baseRowHeight
    )
    renderGridCompletionLines(
      branchCells,
      subStartY,
      branchAreaX,
      branchAreaWidth,
      baseRowHeight,
      settings,
      lines,
      "branch",
      {
        top: subStartY,
        bottom: subBottom,
        rightEdges: branchRightEdges,
        leftEdges: [
          { yTop: subStartY, yBottom: subBottom, leftX: branchAreaX },
        ],
      }
    )
  } else {
    // 縦配置
    let branchY = subStartY
    sub.branchQuestions.forEach((branch, branchIndex) => {
      const branchHeight = branch.heightMultiplier * baseRowHeight
      const effBranchNumW = branch.label === "" ? 0 : branchNumWidth
      const effBranchAnswerX = branchNumX + effBranchNumW
      const effBranchAnswerW = contentRight - effBranchAnswerX

      if (effBranchNumW > 0) {
        numberLabels.push({
          text: branch.label,
          x: branchNumX,
          y: branchY,
          width: effBranchNumW,
          height: branchHeight,
          fontSize: settings.fonts.branchNumberSize,
          displayMode: "branch",
        })
      }

      const branchPoints = sub.usesBranchPoints === false ? 0 : branch.points
      cells.push(
        createCell(
          [majorIndex, subIndex, branchIndex],
          effBranchAnswerX,
          branchY,
          effBranchAnswerW,
          branchHeight,
          paper,
          `${majorLabel}-${sub.label}-${branch.label}`,
          branchPoints,
          branch.textElements,
          "answer",
          pageIndex,
          undefined,
          branch.omrConfig,
          branch.imageElements
        )
      )

      if (branchIndex < sub.branchQuestions.length - 1) {
        lines.push({
          x1: branchNumX,
          y1: branchY + branchHeight,
          x2: contentRight,
          y2: branchY + branchHeight,
          style: settings.borderConfig.branchDivider,
          lineType: "branch",
          strokeWidth: getLineWidth("branch", settings.borderConfig),
          dragInfo: {
            axis: "horizontal",
            target: {
              type: "heightMultiplier",
              cell: { branchQuestionId: branch.id },
            },
            currentValueMm: branchHeight,
            minMm: baseRowHeight * 0.5,
          },
        })
      }

      branchY += branchHeight
    })
  }
}
