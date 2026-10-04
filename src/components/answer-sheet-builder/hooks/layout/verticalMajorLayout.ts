/**
 * 縦配置の大問の配置。
 *
 * 小問を上から1行ずつ積み、セル・番号ラベル・行間の区切り線を描く。番号列の縦線は
 * ページの最後にまとめて引くので、ここでは引く区間だけを集める。
 */

import type { ComputedLine } from "@/types/answerSheetLayout.types"

import { renderBranchQuestions } from "./branchRenderer"
import {
  computeManuscriptGrid,
  computeSubHeight,
  createCell,
} from "./cellBuilder"
import {
  buildBranchGridLayout,
  computeGridRowRightEdges,
  isGridHorizontal,
} from "./gridBuilder"
import { getLineWidth } from "./layoutUtils"
import {
  availableBranchAreaWidth,
  requiredBranchAreaWidth,
} from "./manuscriptWidth"
import type {
  LayoutColumnSink,
  LayoutPageSink,
  MajorLayoutContext,
  MajorPlacement,
} from "./types"

/** 縦配置の大問を置き、大問の下端の Y を返す */
export function layoutVerticalMajor(
  context: MajorLayoutContext,
  placement: MajorPlacement,
  page: LayoutPageSink,
  column: LayoutColumnSink
): number {
  const { settings, paper, subNumWidth, branchNumWidth, withDragInfo } = context
  const { baseRowHeight } = settings
  const { major, majorIndex, startY, pageIndex, bounds, horizontalAreaWidth } =
    placement
  let localY = startY

  // 各小問の右端X座標を事前計算（原稿用紙セルは必要幅に制限）
  const subRightEdges = major.subQuestions.map((sub) => {
    const effSubNumWidth = sub.label === "" ? 0 : subNumWidth
    const answerAreaX = bounds.subNumX + effSubNumWidth
    if (sub.branchQuestions.length > 0) {
      // 枝問の必要幅を親の右端へ積み上げる（高さと同じ向き）
      const branchAreaWidth = requiredBranchAreaWidth(
        sub.branchQuestions,
        baseRowHeight,
        branchNumWidth,
        availableBranchAreaWidth(sub, horizontalAreaWidth, subNumWidth)
      )
      if (branchAreaWidth == null) return bounds.contentRight
      return answerAreaX + branchAreaWidth
    }
    if (!sub.manuscriptPaper?.enabled) return bounds.contentRight
    const subHeight = computeSubHeight(
      sub,
      baseRowHeight,
      horizontalAreaWidth,
      subNumWidth,
      branchNumWidth
    )
    return (
      answerAreaX +
      (subHeight / sub.manuscriptPaper.rows) * sub.manuscriptPaper.columns
    )
  })

  major.subQuestions.forEach((sub, subIndex) => {
    const subStartY = localY
    const hasBranches = sub.branchQuestions.length > 0
    const subHeight = computeSubHeight(
      sub,
      baseRowHeight,
      horizontalAreaWidth,
      subNumWidth,
      branchNumWidth
    )
    const effSubNumW = sub.label === "" ? 0 : subNumWidth
    const effBranchNumX = bounds.subNumX + effSubNumW
    const effBranchNumW = hasBranches ? branchNumWidth : 0
    const effAnswerX = effBranchNumX + effBranchNumW
    const effAnswerWidth = bounds.contentRight - effAnswerX

    if (effSubNumW > 0) {
      page.numberLabels.push({
        text: sub.label,
        x: bounds.subNumX,
        y: subStartY,
        width: effSubNumW,
        height: subHeight,
        fontSize: settings.fonts.subNumberSize,
        displayMode: "sub",
      })
    }

    if (hasBranches) {
      renderBranchQuestions(
        sub,
        majorIndex,
        subIndex,
        major.label,
        subStartY,
        pageIndex,
        bounds.subNumX,
        effSubNumW,
        effBranchNumX,
        branchNumWidth,
        effAnswerX,
        effAnswerWidth,
        subRightEdges[subIndex],
        availableBranchAreaWidth(sub, horizontalAreaWidth, subNumWidth),
        baseRowHeight,
        paper,
        settings,
        page.cells,
        page.lines,
        page.numberLabels,
        column.rowRightEdges
      )

      // 枝問番号列のセグメント（ラベルのある枝問のみ）
      if (!isGridHorizontal(sub.branchQuestions)) {
        const effBranchLineX = effBranchNumX + branchNumWidth
        let branchSegStart: number | null = null
        let branchY = subStartY
        for (const branchQuestion of sub.branchQuestions) {
          const bqH = branchQuestion.heightMultiplier * baseRowHeight
          if (branchQuestion.label !== "") {
            if (branchSegStart === null) branchSegStart = branchY
          } else {
            if (branchSegStart !== null) {
              column.branchVerticalRanges.push({
                top: branchSegStart,
                bottom: branchY,
                lineX: effBranchLineX,
              })
              branchSegStart = null
            }
          }
          branchY += bqH
        }
        if (branchSegStart !== null) {
          column.branchVerticalRanges.push({
            top: branchSegStart,
            bottom: branchY,
            lineX: effBranchLineX,
          })
        }
      }
    } else {
      let ansW = effAnswerWidth
      if (sub.manuscriptPaper?.enabled) {
        const cellSz = subHeight / sub.manuscriptPaper.rows
        const gridW = cellSz * sub.manuscriptPaper.columns
        ansW = gridW
      }
      page.cells.push(
        createCell(
          [majorIndex, subIndex],
          effAnswerX,
          subStartY,
          ansW,
          subHeight,
          paper,
          `${major.label}-${sub.label}`,
          sub.points,
          sub.textElements,
          "answer",
          pageIndex,
          computeManuscriptGrid(
            sub,
            effAnswerX,
            subStartY,
            ansW,
            subHeight,
            settings.borderConfig
          ),
          sub.omrConfig,
          sub.imageElements
        )
      )
    }

    // vertical-sub行の右端（枝問横配置時は枝問グリッドの右端を使用）
    if (hasBranches && isGridHorizontal(sub.branchQuestions)) {
      const branchAreaX = bounds.subNumX + effSubNumW
      const branchAreaWidth = subRightEdges[subIndex] - branchAreaX
      const branchCells = buildBranchGridLayout(
        sub.branchQuestions,
        baseRowHeight,
        branchNumWidth,
        availableBranchAreaWidth(sub, horizontalAreaWidth, subNumWidth)
      )
      for (const edge of computeGridRowRightEdges(
        branchCells,
        subStartY,
        branchAreaX,
        branchAreaWidth,
        baseRowHeight
      )) {
        column.rowRightEdges.push(edge)
      }
    } else {
      column.rowRightEdges.push({
        yTop: subStartY,
        yBottom: subStartY + subHeight,
        rightX: subRightEdges[subIndex],
      })
    }
    // vertical-sub行の左端は常に段の左端
    column.rowLeftEdges.push({
      yTop: subStartY,
      yBottom: subStartY + subHeight,
      leftX: bounds.contentLeft,
    })

    localY += subHeight

    // 行間の区切り線（最後の行以外）
    if (subIndex < major.subQuestions.length - 1) {
      const dividerRightX = Math.max(
        subRightEdges[subIndex],
        subRightEdges[subIndex + 1]
      )
      const dragInfo: Pick<ComputedLine, "dragInfo"> = withDragInfo
        ? {
            dragInfo: {
              axis: "horizontal",
              target: {
                type: "heightMultiplier",
                cell: { subQuestionId: sub.id },
              },
              currentValueMm: hasBranches
                ? sub.branchQuestions.reduce(
                    (sum, branchQuestion) =>
                      sum + branchQuestion.heightMultiplier * baseRowHeight,
                    0
                  )
                : sub.heightMultiplier * baseRowHeight,
              minMm: baseRowHeight * 0.5,
            },
          }
        : {}
      page.lines.push({
        x1: bounds.subNumX,
        y1: localY,
        x2: dividerRightX,
        y2: localY,
        style: settings.borderConfig.subDivider,
        lineType: "sub",
        strokeWidth: getLineWidth("sub", settings.borderConfig),
        ...dragInfo,
      })
    }
  })

  // 小問番号列セグメント: ラベルのある小問の区間だけ
  let subSegStart: number | null = null
  let subTrackY = startY
  for (const sub of major.subQuestions) {
    const subH = computeSubHeight(
      sub,
      baseRowHeight,
      horizontalAreaWidth,
      subNumWidth,
      branchNumWidth
    )
    if (sub.label !== "") {
      if (subSegStart === null) subSegStart = subTrackY
    } else {
      if (subSegStart !== null) {
        column.verticalRanges.push({
          top: subSegStart,
          bottom: subTrackY,
        })
        subSegStart = null
      }
    }
    subTrackY += subH
  }
  if (subSegStart !== null) {
    column.verticalRanges.push({ top: subSegStart, bottom: subTrackY })
  }

  return localY
}
