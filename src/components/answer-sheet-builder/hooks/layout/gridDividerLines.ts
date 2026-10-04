/**
 * グリッド配置のセルまわりの区切り線。
 *
 * 隣り合うセルの共有辺（`renderGridDividerLines`）と、セルと空白の境目
 * （`renderGridCompletionLines`）を描く。外枠は `outerBorderLines.ts` が描く。
 */

import type {
  GlobalSettings,
  NextPlacement,
} from "@/types/answerSheetDefinition.types"
import type { ComputedLine, GridCell } from "@/types/answerSheetLayout.types"

import { getLineWidth } from "./layoutUtils"
import type { RowLeftEdge, RowRightEdge } from "./types"

/** 指定Y位置で外枠の最大rightXを取得し、セル右端とのminを返す */
function clipRightToOuter(
  y: number,
  cellRight: number,
  rightEdges: RowRightEdge[]
): number {
  let maxOuter = -Infinity
  for (const rightEdge of rightEdges) {
    if (rightEdge.yTop <= y + 1e-9 && rightEdge.yBottom >= y - 1e-9) {
      maxOuter = Math.max(maxOuter, rightEdge.rightX)
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
    rightEdges: RowRightEdge[]
    leftEdges: RowLeftEdge[]
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

  for (const gridCell of gridCells) {
    const left = areaX + gridCell.x * areaWidth
    const right = areaX + (gridCell.x + gridCell.width) * areaWidth
    const top = areaStartY + gridCell.y * baseRowHeight
    const bottom = areaStartY + (gridCell.y + gridCell.height) * baseRowHeight

    // 右辺: セルの右端が外枠の rightX 以上ならスキップ（外枠が境界を描画する）
    for (const rightEdge of rightEdges) {
      const oTop = Math.max(top, rightEdge.yTop)
      const oBottom = Math.min(bottom, rightEdge.yBottom)
      if (oBottom <= oTop + 1e-9) continue
      if (right >= rightEdge.rightX - 0.01) continue
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
    for (const leftEdge of leftEdges) {
      const oTop = Math.max(top, leftEdge.yTop)
      const oBottom = Math.min(bottom, leftEdge.yBottom)
      if (oBottom <= oTop + 1e-9) continue
      if (left <= leftEdge.leftX + 0.01) continue
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
    const cellA = gridCells[i]
    for (let j = i + 1; j < gridCells.length; j++) {
      const cellB = gridCells[j]

      // 垂直共有辺: cellAの右端 === cellBの左端 かつ Y方向にオーバーラップ
      const aRight = cellA.x + cellA.width
      const bLeft = cellB.x
      if (Math.abs(aRight - bLeft) < 1e-9) {
        const overlapTop = Math.max(cellA.y, cellB.y)
        const overlapBottom = Math.min(
          cellA.y + cellA.height,
          cellB.y + cellB.height
        )
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

      // 水平共有辺: cellAの下端 === cellBの上端 かつ X方向にオーバーラップ
      const aBottom = cellA.y + cellA.height
      const bTop = cellB.y
      if (Math.abs(aBottom - bTop) < 1e-9) {
        const overlapLeft = Math.max(cellA.x, cellB.x)
        const overlapRight = Math.min(
          cellA.x + cellA.width,
          cellB.x + cellB.width
        )
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
