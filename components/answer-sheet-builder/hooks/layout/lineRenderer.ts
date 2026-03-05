/**
 * 罫線レンダリング関数群
 *
 * グリッドセル間の区切り線、外枠線（ステップ形状対応）、
 * 枝問描画、OMRマーカーの座標計算を提供する。
 */

import type {
  BorderConfig,
  GlobalSettings,
  LineStyle,
  NextPlacement,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"
import type {
  ComputedCell,
  ComputedLine,
  ComputedNumberLabel,
  ComputedOMRMarker,
  GridCell,
} from "@/types/answerSheetLayout.types"

import { createCell } from "./cellBuilder"
import {
  buildBranchGridLayout,
  computeGridRowRightEdges,
  gridTotalHeight,
  isGridHorizontal,
} from "./gridBuilder"
import { getLineWidth } from "./layoutUtils"

/** 指定Y位置で外枠の最大rightXを取得し、セル右端とのminを返す */
function clipRightToOuter(
  y: number,
  cellRight: number,
  rightEdges: { yTop: number; yBottom: number; rightX: number }[]
): number {
  let maxOuter = -Infinity
  for (const re of rightEdges) {
    if (re.yTop <= y + 1e-9 && re.yBottom >= y - 1e-9) {
      maxOuter = Math.max(maxOuter, re.rightX)
    }
  }
  return maxOuter > -Infinity ? Math.min(cellRight, maxOuter) : cellRight
}

/**
 * グリッドセルの空白隣接辺を描画する。
 * renderGridDividerLines は隣接セル間の共有辺のみ、addSteppedBorderLines は外枠のみ描画するため、
 * セルと空白スペースの境界はどちらにも描画されない。この関数がそれを補完する。
 */
export function renderGridCompletionLines<
  T extends {
    layoutWidth?: string
    nextPlacement?: NextPlacement
    heightMultiplier: number
  },
>(
  gridCells: GridCell<T>[],
  areaStartY: number,
  areaX: number,
  areaWidth: number,
  baseRowHeight: number,
  settings: GlobalSettings,
  lines: ComputedLine[],
  level: "sub" | "branch",
  outerBounds: {
    top: number
    bottom: number
    rightEdges: { yTop: number; yBottom: number; rightX: number }[]
    leftEdges: { yTop: number; yBottom: number; leftX: number }[]
  }
) {
  if (gridCells.length <= 1) return

  const lineType: ComputedLine["lineType"] =
    level === "sub" ? "subHorizontalDivider" : "branch"
  const divStyle =
    level === "sub"
      ? settings.borderConfig.subDivider
      : settings.borderConfig.branchDivider
  const sw = getLineWidth(lineType, settings.borderConfig)

  const {
    top: outerTop,
    bottom: outerBottom,
    rightEdges,
    leftEdges,
  } = outerBounds

  for (const gc of gridCells) {
    const left = areaX + gc.x * areaWidth
    const right = areaX + (gc.x + gc.width) * areaWidth
    const top = areaStartY + gc.y * baseRowHeight
    const bottom = areaStartY + (gc.y + gc.height) * baseRowHeight

    // 右辺: セルの右端が外枠の rightX 以上ならスキップ（外枠が境界を描画する）
    for (const re of rightEdges) {
      const oTop = Math.max(top, re.yTop)
      const oBottom = Math.min(bottom, re.yBottom)
      if (oBottom <= oTop + 1e-9) continue
      if (right >= re.rightX - 0.01) continue
      lines.push({
        x1: right,
        y1: oTop,
        x2: right,
        y2: oBottom,
        style: divStyle,
        lineType,
        strokeWidth: sw,
      })
    }

    // 左辺: セルの左端が外枠の leftX 以下ならスキップ
    for (const le of leftEdges) {
      const oTop = Math.max(top, le.yTop)
      const oBottom = Math.min(bottom, le.yBottom)
      if (oBottom <= oTop + 1e-9) continue
      if (left <= le.leftX + 0.01) continue
      lines.push({
        x1: left,
        y1: oTop,
        x2: left,
        y2: oBottom,
        style: divStyle,
        lineType,
        strokeWidth: sw,
      })
    }

    // 下辺: グリッド外枠の底辺と一致しない場合のみ（右端を外枠にクリップ）
    if (Math.abs(bottom - outerBottom) > 0.01) {
      const clipRight = clipRightToOuter(bottom, right, rightEdges)
      if (clipRight > left + 1e-9) {
        lines.push({
          x1: left,
          y1: bottom,
          x2: clipRight,
          y2: bottom,
          style: divStyle,
          lineType,
          strokeWidth: sw,
        })
      }
    }

    // 上辺: グリッド外枠の上辺と一致しない場合のみ（右端を外枠にクリップ）
    if (Math.abs(top - outerTop) > 0.01) {
      const clipRight = clipRightToOuter(top, right, rightEdges)
      if (clipRight > left + 1e-9) {
        lines.push({
          x1: left,
          y1: top,
          x2: clipRight,
          y2: top,
          style: divStyle,
          lineType,
          strokeWidth: sw,
        })
      }
    }
  }
}

/** グリッドセル間の区切り線を描画 */
export function renderGridDividerLines<
  T extends {
    layoutWidth?: string
    nextPlacement?: NextPlacement
    heightMultiplier: number
  },
>(
  gridCells: GridCell<T>[],
  areaStartY: number,
  areaX: number,
  areaWidth: number,
  baseRowHeight: number,
  settings: GlobalSettings,
  lines: ComputedLine[],
  level: "sub" | "branch"
) {
  const lineType = level === "sub" ? "subHorizontalDivider" : "branch"
  const divStyle =
    level === "sub"
      ? settings.borderConfig.subDivider
      : settings.borderConfig.branchDivider
  const divSw = getLineWidth(lineType, settings.borderConfig)

  // 隣接セル間の共有辺に区切り線を描画
  for (let i = 0; i < gridCells.length; i++) {
    const a = gridCells[i]
    for (let j = i + 1; j < gridCells.length; j++) {
      const b = gridCells[j]

      // 垂直共有辺: aの右端 === bの左端 かつ Y方向にオーバーラップ
      const aRight = a.x + a.width
      const bLeft = b.x
      if (Math.abs(aRight - bLeft) < 1e-9) {
        const overlapTop = Math.max(a.y, b.y)
        const overlapBottom = Math.min(a.y + a.height, b.y + b.height)
        if (overlapBottom > overlapTop + 1e-9) {
          const lineX = areaX + aRight * areaWidth
          lines.push({
            x1: lineX,
            y1: areaStartY + overlapTop * baseRowHeight,
            x2: lineX,
            y2: areaStartY + overlapBottom * baseRowHeight,
            style: divStyle,
            lineType,
            strokeWidth: divSw,
          })
        }
      }

      // 水平共有辺: aの下端 === bの上端 かつ X方向にオーバーラップ
      const aBottom = a.y + a.height
      const bTop = b.y
      if (Math.abs(aBottom - bTop) < 1e-9) {
        const overlapLeft = Math.max(a.x, b.x)
        const overlapRight = Math.min(a.x + a.width, b.x + b.width)
        if (overlapRight > overlapLeft + 1e-9) {
          const lineY = areaStartY + aBottom * baseRowHeight
          lines.push({
            x1: areaX + overlapLeft * areaWidth,
            y1: lineY,
            x2: areaX + overlapRight * areaWidth,
            y2: lineY,
            style: divStyle,
            lineType,
            strokeWidth: divSw,
          })
        }
      }
    }
  }
}

/** 枝問の描画（横配置・縦配置両対応） */
export function renderBranchQuestions(
  sub: SubQuestion,
  mi: number,
  si: number,
  majorLabel: string,
  subStartY: number,
  pageIndex: number,
  subNumX: number,
  subNumWidth: number,
  branchNumX: number,
  branchNumWidth: number,
  answerX: number,
  answerWidth: number,
  contentRight: number,
  baseRowHeight: number,
  paper: { width: number; height: number },
  settings: GlobalSettings,
  cells: ComputedCell[],
  lines: ComputedLine[],
  numberLabels: ComputedNumberLabel[],
  _rowRightEdges: { yTop: number; yBottom: number; rightX: number }[]
) {
  const branchIsHorizontal = isGridHorizontal(sub.branchQuestions)

  if (branchIsHorizontal) {
    const branchAreaX = subNumX + subNumWidth
    const branchAreaWidth = contentRight - branchAreaX
    const branchCells = buildBranchGridLayout(sub.branchQuestions)

    for (const gc of branchCells) {
      const cellX = branchAreaX + gc.x * branchAreaWidth
      const cellWidth = gc.width * branchAreaWidth
      const cellY = subStartY + gc.y * baseRowHeight
      const cellHeight = gc.height * baseRowHeight
      const effBranchNumW = gc.item.label === "" ? 0 : branchNumWidth

      if (effBranchNumW > 0) {
        numberLabels.push({
          text: gc.item.label,
          x: cellX,
          y: cellY,
          width: effBranchNumW,
          height: cellHeight,
          fontSize: settings.fonts.branchNumberSize,
          displayMode: "branch-horizontal",
        })
      }

      cells.push(
        createCell(
          [mi, si, gc.itemIndex],
          cellX + effBranchNumW,
          cellY,
          cellWidth - effBranchNumW,
          cellHeight,
          paper,
          `${majorLabel}-${sub.label}-${gc.item.label}`,
          gc.item.points,
          gc.item.textElements,
          "answer",
          pageIndex,
          undefined,
          gc.item.omrConfig,
          gc.item.imageElements
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
    sub.branchQuestions.forEach((branch, bi) => {
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

      cells.push(
        createCell(
          [mi, si, bi],
          effBranchAnswerX,
          branchY,
          effBranchAnswerW,
          branchHeight,
          paper,
          `${majorLabel}-${sub.label}-${branch.label}`,
          branch.points,
          branch.textElements,
          "answer",
          pageIndex,
          undefined,
          branch.omrConfig,
          branch.imageElements
        )
      )

      if (bi < sub.branchQuestions.length - 1) {
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
              majorIndex: mi,
              subIndex: si,
              branchIndex: bi,
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

/** 矩形外枠線を追加する */
export function addBorderLines(
  lines: ComputedLine[],
  l: number,
  t: number,
  r: number,
  b: number,
  style: LineStyle,
  borderConfig: BorderConfig
) {
  const sw = getLineWidth("outer", borderConfig)
  lines.push({
    x1: l,
    y1: t,
    x2: r,
    y2: t,
    style,
    lineType: "outer",
    strokeWidth: sw,
  })
  lines.push({
    x1: l,
    y1: b,
    x2: r,
    y2: b,
    style,
    lineType: "outer",
    strokeWidth: sw,
  })
  lines.push({
    x1: l,
    y1: t,
    x2: l,
    y2: b,
    style,
    lineType: "outer",
    strokeWidth: sw,
  })
  lines.push({
    x1: r,
    y1: t,
    x2: r,
    y2: b,
    style,
    lineType: "outer",
    strokeWidth: sw,
  })
}

/**
 * ステップ外枠描画: partial行がある場合、右辺/左辺をL字型に凹ませる。
 * 全行がcontentRight/contentLeftまで到達している場合は通常の矩形外枠を描画。
 */
export function addSteppedBorderLines(
  lines: ComputedLine[],
  contentLeft: number,
  contentTop: number,
  contentRight: number,
  contentBottom: number,
  style: LineStyle,
  borderConfig: BorderConfig,
  rowRightEdges: { yTop: number; yBottom: number; rightX: number }[],
  rowLeftEdges?: { yTop: number; yBottom: number; leftX: number }[]
) {
  const sw = getLineWidth("outer", borderConfig)

  // 右辺にステップが必要か
  const hasPartialRightRow = rowRightEdges.some(
    (r) => Math.abs(r.rightX - contentRight) > 0.01
  )
  // 左辺にステップが必要か
  const hasPartialLeftRow =
    rowLeftEdges?.some((r) => Math.abs(r.leftX - contentLeft) > 0.01) ?? false

  if (!hasPartialRightRow && !hasPartialLeftRow) {
    addBorderLines(
      lines,
      contentLeft,
      contentTop,
      contentRight,
      contentBottom,
      style,
      borderConfig
    )
    return
  }

  if (rowRightEdges.length === 0) {
    addBorderLines(
      lines,
      contentLeft,
      contentTop,
      contentRight,
      contentBottom,
      style,
      borderConfig
    )
    return
  }

  // === 上辺 ===
  const topLeftX =
    hasPartialLeftRow && rowLeftEdges!.length > 0
      ? rowLeftEdges![0].leftX
      : contentLeft
  const topRightX = rowRightEdges[0].rightX
  lines.push({
    x1: topLeftX,
    y1: contentTop,
    x2: topRightX,
    y2: contentTop,
    style,
    lineType: "outer",
    strokeWidth: sw,
  })

  // === 左辺（ステップまたはストレート） ===
  if (!hasPartialLeftRow) {
    lines.push({
      x1: contentLeft,
      y1: contentTop,
      x2: contentLeft,
      y2: contentBottom,
      style,
      lineType: "outer",
      strokeWidth: sw,
    })
  } else {
    let curLeftY = contentTop
    let curLeftX = rowLeftEdges![0].leftX

    for (let i = 1; i < rowLeftEdges!.length; i++) {
      const edge = rowLeftEdges![i]

      if (Math.abs(edge.leftX - curLeftX) > 0.01) {
        lines.push({
          x1: curLeftX,
          y1: curLeftY,
          x2: curLeftX,
          y2: edge.yTop,
          style,
          lineType: "outer",
          strokeWidth: sw,
        })
        lines.push({
          x1: Math.min(curLeftX, edge.leftX),
          y1: edge.yTop,
          x2: Math.max(curLeftX, edge.leftX),
          y2: edge.yTop,
          style,
          lineType: "outer",
          strokeWidth: sw,
        })
        curLeftY = edge.yTop
        curLeftX = edge.leftX
      }
    }

    lines.push({
      x1: curLeftX,
      y1: curLeftY,
      x2: curLeftX,
      y2: contentBottom,
      style,
      lineType: "outer",
      strokeWidth: sw,
    })
  }

  // === 右辺（ステップ描画） ===
  let curY = contentTop
  let curRightX = topRightX

  for (let i = 1; i < rowRightEdges.length; i++) {
    const edge = rowRightEdges[i]

    if (Math.abs(edge.rightX - curRightX) > 0.01) {
      lines.push({
        x1: curRightX,
        y1: curY,
        x2: curRightX,
        y2: edge.yTop,
        style,
        lineType: "outer",
        strokeWidth: sw,
      })
      lines.push({
        x1: Math.min(curRightX, edge.rightX),
        y1: edge.yTop,
        x2: Math.max(curRightX, edge.rightX),
        y2: edge.yTop,
        style,
        lineType: "outer",
        strokeWidth: sw,
      })
      curY = edge.yTop
      curRightX = edge.rightX
    }
  }

  lines.push({
    x1: curRightX,
    y1: curY,
    x2: curRightX,
    y2: contentBottom,
    style,
    lineType: "outer",
    strokeWidth: sw,
  })

  // === 下辺 ===
  const bottomLeftX =
    hasPartialLeftRow && rowLeftEdges!.length > 0
      ? rowLeftEdges![rowLeftEdges!.length - 1].leftX
      : contentLeft
  lines.push({
    x1: bottomLeftX,
    y1: contentBottom,
    x2: curRightX,
    y2: contentBottom,
    style,
    lineType: "outer",
    strokeWidth: sw,
  })
}

/** OMRマーカー（四隅）の座標を計算する */
export function computeOMRMarkers(
  settings: GlobalSettings,
  paper: { width: number; height: number }
): ComputedOMRMarker[] {
  if (!settings.omrMarkers.enabled) return []
  const { sizeMm, offsetMm } = settings.omrMarkers
  return [
    { x: offsetMm, y: offsetMm, size: sizeMm },
    { x: paper.width - offsetMm - sizeMm, y: offsetMm, size: sizeMm },
    { x: offsetMm, y: paper.height - offsetMm - sizeMm, size: sizeMm },
    {
      x: paper.width - offsetMm - sizeMm,
      y: paper.height - offsetMm - sizeMm,
      size: sizeMm,
    },
  ]
}
