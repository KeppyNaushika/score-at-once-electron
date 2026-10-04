/**
 * 外枠線。
 *
 * 行の右端・左端が揃っていなければ L 字に凹ませる（ステップ形状）。
 */

import type {
  BorderConfig,
  BorderLineStyle,
} from "@/types/answerSheetDefinition.types"
import type { ComputedLine } from "@/types/answerSheetLayout.types"

import { getLineWidth } from "./layoutUtils"
import type { RowLeftEdge, RowRightEdge } from "./types"

/** 矩形外枠線を追加する */
function addBorderLines(
  lines: ComputedLine[],
  l: number,
  t: number,
  r: number,
  b: number,
  style: BorderLineStyle,
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
  style: BorderLineStyle,
  borderConfig: BorderConfig,
  rowRightEdges: RowRightEdge[],
  rowLeftEdges?: RowLeftEdge[]
) {
  const sw = getLineWidth("outer", borderConfig)

  // 右辺にステップが必要か
  const hasPartialRightRow = rowRightEdges.some(
    (rowEdge) => Math.abs(rowEdge.rightX - contentRight) > 0.01
  )
  // 左辺にステップが必要か
  const hasPartialLeftRow =
    rowLeftEdges?.some(
      (rowEdge) => Math.abs(rowEdge.leftX - contentLeft) > 0.01
    ) ?? false

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
