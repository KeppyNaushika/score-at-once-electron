/**
 * グリッドレイアウトビルダー
 *
 * layoutWidth / nextPlacement / goUp を使った横配置グリッドの構築と、
 * Sub / Branch 用の特化ビルダーを提供する。
 */

import type {
  BranchQuestion,
  NextPlacement,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"
import type {
  BranchGridCell,
  GridCell,
  SubGridCell,
} from "@/types/answerSheetLayout.types"

import { parseFraction } from "./layoutUtils"

interface RowTrack {
  y: number // この行のY位置（baseRowHeight単位）
  rightX: number // この行の最右端X（0〜1）
  maxH: number // この行内の最大高さ
}

/**
 * 汎用グリッドレイアウトビルダー。
 * layoutWidth を持つ要素が1つでもあれば横配置モード。
 */
export function buildGridLayout<
  T extends {
    layoutWidth?: string
    nextPlacement?: NextPlacement
    goUp?: number
    heightMultiplier: number
  },
>(items: T[]): GridCell<T>[] {
  const isHorizontal = items.some((item) => item.layoutWidth != null)
  if (!isHorizontal) {
    // 全て縦配置: 各要素は全幅
    let y = 0
    return items.map((item, i) => {
      const cell: GridCell<T> = {
        item,
        itemIndex: i,
        x: 0,
        y,
        width: 1,
        height: item.heightMultiplier,
      }
      y += item.heightMultiplier
      return cell
    })
  }

  const cells: GridCell<T>[] = []
  const rows: RowTrack[] = [{ y: 0, rightX: 0, maxH: 0 }]
  let curRowIdx = 0
  let curX = 0
  let blockLeftX = 0
  let lastCellBottom = 0 // 最後に配置したセルの下端Y（goUpブロック内の行スキップ用）

  /** 次の行に進む。既存行の再利用 → ブロック内中間行の作成 → ブロック脱出 の順で試行。 */
  function advanceRow(nextW: number) {
    let advanced = false

    if (blockLeftX + nextW <= 1 + 1e-9) {
      // 幅的にブロック内に収まる → lastCellBottom に一致する既存行を探す
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        if (Math.abs(rows[rowIndex].y - lastCellBottom) < 1e-9) {
          curRowIdx = rowIndex
          curX = blockLeftX
          advanced = true
          break
        }
      }
    }

    if (!advanced) {
      // グリッド全体の下端を計算
      let gridBottom = 0
      for (const row of rows) {
        gridBottom = Math.max(gridBottom, row.y + row.maxH)
      }

      if (
        blockLeftX > 1e-9 &&
        blockLeftX + nextW <= 1 + 1e-9 &&
        lastCellBottom < gridBottom - 1e-9
      ) {
        // goUpブロック内でグリッド高さ内に収まる → 中間行を作成
        curRowIdx = rows.length
        rows.push({ y: lastCellBottom, rightX: 0, maxH: 0 })
        curX = blockLeftX
      } else {
        // goUpブロックを抜ける or 幅超過 → 新しい行を末尾に追加
        const newY = Math.max(gridBottom, lastCellBottom)
        curRowIdx = rows.length
        rows.push({ y: newY, rightX: 0, maxH: 0 })
        curX = 0
        blockLeftX = 0
      }
    }
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const w = parseFraction(item.layoutWidth ?? "1")
    const h = item.heightMultiplier

    // goUp: この要素自身をN行上に戻して配置
    if (item.goUp != null && item.goUp > 0) {
      const targetIdx = Math.max(0, curRowIdx - item.goUp)
      let maxRightX = 0
      for (let rowIndex = targetIdx; rowIndex <= curRowIdx; rowIndex++) {
        maxRightX = Math.max(maxRightX, rows[rowIndex].rightX)
      }
      curRowIdx = targetIdx
      curX = maxRightX
      blockLeftX = maxRightX

      // goUp先に空きがない場合、全行の末尾に新しい行を追加
      if (curX + w > 1 + 1e-9) {
        const lastRow = rows[rows.length - 1]
        const newY = Math.max(lastRow.y + lastRow.maxH, lastCellBottom)
        curRowIdx = rows.length
        rows.push({ y: newY, rightX: 0, maxH: 0 })
        curX = 0
        blockLeftX = 0
      }
    }

    // 配置前チェック: この項目を置くと1を超える場合、先に改行
    if (curX > blockLeftX + 1e-9 && curX + w > 1 + 1e-9) {
      advanceRow(w)
    }

    cells.push({
      item,
      itemIndex: i,
      x: curX,
      y: rows[curRowIdx].y,
      width: w,
      height: h,
    })

    lastCellBottom = rows[curRowIdx].y + h
    rows[curRowIdx].rightX = Math.max(rows[curRowIdx].rightX, curX + w)
    rows[curRowIdx].maxH = Math.max(rows[curRowIdx].maxH, h)

    const nextPlacement = item.nextPlacement ?? "inline"
    if (nextPlacement === "inline") {
      curX += w
    } else if (nextPlacement === "break") {
      if (blockLeftX > 1e-9) {
        // goUpブロック内の break → ブロック残幅で既存行を検索
        advanceRow(1 - blockLeftX)
      } else {
        // 通常の break → 新しい行を追加
        const lastRow = rows[rows.length - 1]
        const newY = lastRow.y + lastRow.maxH
        curRowIdx = rows.length
        rows.push({ y: newY, rightX: 0, maxH: 0 })
        curX = 0
        blockLeftX = 0
      }
    }
  }
  return cells
}

/** SubQuestion 用のグリッドレイアウト */
export function buildSubGridLayout(subQuestions: SubQuestion[]): SubGridCell[] {
  // 枝問がある小問は、枝問レイアウトの要求高さで heightMultiplier を上書き
  // 原稿用紙有効時は heightMultiplier × rows に拡張
  const adjusted = subQuestions.map((sub) => {
    if (sub.branchQuestions.length > 0) {
      const branchCells = buildBranchGridLayout(sub.branchQuestions)
      const branchHeight = gridTotalHeight(branchCells)
      if (branchHeight !== sub.heightMultiplier) {
        return { ...sub, heightMultiplier: branchHeight }
      }
      return sub
    }
    if (sub.manuscriptPaper?.enabled) {
      return {
        ...sub,
        heightMultiplier: sub.heightMultiplier * sub.manuscriptPaper.rows,
      }
    }
    return sub
  })
  return buildGridLayout(adjusted)
}

/** BranchQuestion 用のグリッドレイアウト */
export function buildBranchGridLayout(
  branchQuestions: BranchQuestion[]
): BranchGridCell[] {
  // 原稿用紙有効時は heightMultiplier × rows に拡張（小問と同じ）
  return buildGridLayout(
    branchQuestions.map((branchQuestion) =>
      branchQuestion.manuscriptPaper?.enabled
        ? {
            ...branchQuestion,
            heightMultiplier:
              branchQuestion.heightMultiplier *
              branchQuestion.manuscriptPaper.rows,
          }
        : branchQuestion
    )
  )
}

/** グリッドレイアウトが横配置モードかどうか */
export function isGridHorizontal<
  T extends {
    layoutWidth?: string
    manuscriptPaper?: { enabled: boolean }
  },
>(items: T[]): boolean {
  return items.some(
    (item) => item.layoutWidth != null || item.manuscriptPaper?.enabled
  )
}

/** グリッドセル配列の合計高さ（baseRowHeight単位） */
export function gridTotalHeight<T>(cells: GridCell<T>[]): number {
  if (cells.length === 0) return 0
  return Math.max(...cells.map((cell) => cell.y + cell.height))
}

/** 絶対座標のY区間・右端エントリをマージする（同一Y区間の最大rightXを取る） */
export function mergeAbsoluteRightEdges(
  edges: { yTop: number; yBottom: number; rightX: number }[]
): { yTop: number; yBottom: number; rightX: number }[] {
  if (edges.length === 0) return []
  const ySet = new Set<number>()
  for (const edge of edges) {
    ySet.add(edge.yTop)
    ySet.add(edge.yBottom)
  }
  const sortedYs = Array.from(ySet).sort((yA, yB) => yA - yB)
  const result: { yTop: number; yBottom: number; rightX: number }[] = []
  for (let i = 0; i < sortedYs.length - 1; i++) {
    const yTop = sortedYs[i]
    const yBottom = sortedYs[i + 1]
    const midY = (yTop + yBottom) / 2
    let maxRightX = 0
    for (const edge of edges) {
      if (edge.yTop <= midY + 1e-9 && edge.yBottom >= midY - 1e-9) {
        maxRightX = Math.max(maxRightX, edge.rightX)
      }
    }
    if (maxRightX > 0) {
      if (
        result.length > 0 &&
        Math.abs(result[result.length - 1].rightX - maxRightX) < 0.01
      ) {
        result[result.length - 1].yBottom = yBottom
      } else {
        result.push({ yTop, yBottom, rightX: maxRightX })
      }
    }
  }
  return result
}

/** グリッドセルからY区間ごとの右端X座標を計算（ステップ外枠描画用） */
export function computeGridRowRightEdges<T>(
  gridCells: GridCell<T>[],
  areaStartY: number,
  areaX: number,
  areaWidth: number,
  baseRowHeight: number
): { yTop: number; yBottom: number; rightX: number }[] {
  const ySet = new Set<number>()
  const absCells: { y: number; yEnd: number; rightX: number }[] = []
  for (const gridCell of gridCells) {
    const cellY = areaStartY + gridCell.y * baseRowHeight
    const cellYEnd = cellY + gridCell.height * baseRowHeight
    const cellRightX = areaX + (gridCell.x + gridCell.width) * areaWidth
    ySet.add(cellY)
    ySet.add(cellYEnd)
    absCells.push({ y: cellY, yEnd: cellYEnd, rightX: cellRightX })
  }

  const sortedYs = Array.from(ySet).sort((yA, yB) => yA - yB)
  const result: { yTop: number; yBottom: number; rightX: number }[] = []

  for (let i = 0; i < sortedYs.length - 1; i++) {
    const yTop = sortedYs[i]
    const yBottom = sortedYs[i + 1]
    const midY = (yTop + yBottom) / 2

    let maxRightX = 0
    for (const cell of absCells) {
      if (cell.y <= midY + 1e-9 && cell.yEnd >= midY - 1e-9) {
        maxRightX = Math.max(maxRightX, cell.rightX)
      }
    }

    if (maxRightX > 0) {
      if (
        result.length > 0 &&
        Math.abs(result[result.length - 1].rightX - maxRightX) < 0.01
      ) {
        result[result.length - 1].yBottom = yBottom
      } else {
        result.push({ yTop, yBottom, rightX: maxRightX })
      }
    }
  }

  return result
}

/** グリッドセルからY区間ごとの左端X座標を計算（ステップ外枠描画用） */
export function computeGridRowLeftEdges<T>(
  gridCells: GridCell<T>[],
  areaStartY: number,
  areaX: number,
  areaWidth: number,
  baseRowHeight: number
): { yTop: number; yBottom: number; leftX: number }[] {
  const ySet = new Set<number>()
  const absCells: { y: number; yEnd: number; leftX: number }[] = []
  for (const gridCell of gridCells) {
    const cellY = areaStartY + gridCell.y * baseRowHeight
    const cellYEnd = cellY + gridCell.height * baseRowHeight
    const cellLeftX = areaX + gridCell.x * areaWidth
    ySet.add(cellY)
    ySet.add(cellYEnd)
    absCells.push({ y: cellY, yEnd: cellYEnd, leftX: cellLeftX })
  }

  const sortedYs = Array.from(ySet).sort((yA, yB) => yA - yB)
  const result: { yTop: number; yBottom: number; leftX: number }[] = []

  for (let i = 0; i < sortedYs.length - 1; i++) {
    const yTop = sortedYs[i]
    const yBottom = sortedYs[i + 1]
    const midY = (yTop + yBottom) / 2

    let minLeftX = Infinity
    for (const cell of absCells) {
      if (cell.y <= midY + 1e-9 && cell.yEnd >= midY - 1e-9) {
        minLeftX = Math.min(minLeftX, cell.leftX)
      }
    }

    if (minLeftX < Infinity) {
      if (
        result.length > 0 &&
        Math.abs(result[result.length - 1].leftX - minLeftX) < 0.01
      ) {
        result[result.length - 1].yBottom = yBottom
      } else {
        result.push({ yTop, yBottom, leftX: minLeftX })
      }
    }
  }

  return result
}
