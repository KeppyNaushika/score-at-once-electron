/**
 * レイアウト計算hook
 *
 * AnswerSheetDefinition → ComputedLayout をuseMemoで計算。
 * フロントエンドではelectron-srcのlayoutEngineを直接importできないため、
 * 同じアルゴリズムをフロントエンド側にも持つ（共有ロジック）。
 */

import { useMemo } from "react"

import type {
  AnswerSheetDefinition,
  BorderConfig,
  BranchGridCell,
  BranchQuestion,
  ComputedCell,
  ComputedLayout,
  ComputedLine,
  ComputedMultiPageLayout,
  ComputedNumberLabel,
  ComputedOMRMarker,
  ComputedPageLayout,
  GlobalSettings,
  GridCell,
  LineStyle,
  MajorQuestion,
  ManuscriptGrid,
  NextPlacement,
  SubGridCell,
  SubQuestion,
} from "@/types/answerSheetBuilder.types"
import type {
  ComputedOMRBubble,
  ComputedOMRDigitBox,
  OMRCellConfig,
} from "@/types/omr.types"

import { PAPER_SIZES } from "../constants"

/** lineType から BorderConfig の線幅を取得するヘルパー */
function getLineWidth(lineType: string, borderConfig: BorderConfig): number {
  switch (lineType) {
    case "outer":
      return borderConfig.outerBorderWidth ?? 0.7
    case "major":
      return borderConfig.majorDividerWidth ?? 0.5
    case "sub":
    case "subHorizontalDivider":
      return borderConfig.subDividerWidth ?? 0.4
    case "branch":
      return borderConfig.branchDividerWidth ?? 0.3
    case "majorNumberColumn":
      return borderConfig.majorNumberDividerWidth ?? 0.4
    case "subNumberColumn":
      return borderConfig.subNumberDividerWidth ?? 0.4
    case "branchNumberColumn":
      return borderConfig.branchNumberDividerWidth ?? 0.3
    default:
      return 0.4
  }
}

function getPaperDimensions(settings: GlobalSettings) {
  const base = PAPER_SIZES[settings.paperSize] ?? PAPER_SIZES.A4
  if (settings.orientation === "landscape") {
    return { width: base.height, height: base.width }
  }
  return { width: base.width, height: base.height }
}

/** 分数文字列 (e.g. "1/4", "3/4") を 0〜1 の数値に変換 */
export function parseFraction(s: string): number {
  const m = s.match(/^(\d+)\/(\d+)$/)
  if (m) return parseInt(m[1]) / parseInt(m[2])
  const n = parseFloat(s)
  return isNaN(n) ? 1 : n
}

interface RowTrack {
  y: number // この行のY位置（baseRowHeight単位）
  rightX: number // この行の最右端X（0〜1）
  maxH: number // この行内の最大高さ
}

/**
 * 汎用グリッドレイアウトビルダー
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
      for (let r = 0; r < rows.length; r++) {
        if (Math.abs(rows[r].y - lastCellBottom) < 1e-9) {
          curRowIdx = r
          curX = blockLeftX
          advanced = true
          break
        }
      }
    }

    if (!advanced) {
      // グリッド全体の下端を計算
      let gridBottom = 0
      for (const r of rows) {
        gridBottom = Math.max(gridBottom, r.y + r.maxH)
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
      for (let r = targetIdx; r <= curRowIdx; r++) {
        maxRightX = Math.max(maxRightX, rows[r].rightX)
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

    const np = item.nextPlacement ?? "inline"
    if (np === "inline") {
      curX += w
    } else if (np === "break") {
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
function buildSubGridLayout(subQuestions: SubQuestion[]): SubGridCell[] {
  // 枝問がある小問は、枝問レイアウトの要求高さで heightMultiplier を上書き
  const adjusted = subQuestions.map((sub) => {
    if (sub.branchQuestions.length === 0) return sub
    const branchCells = buildBranchGridLayout(sub.branchQuestions)
    const branchHeight = gridTotalHeight(branchCells)
    if (branchHeight !== sub.heightMultiplier) {
      return { ...sub, heightMultiplier: branchHeight }
    }
    return sub
  })
  return buildGridLayout(adjusted)
}

/** BranchQuestion 用のグリッドレイアウト */
function buildBranchGridLayout(
  branchQuestions: BranchQuestion[]
): BranchGridCell[] {
  return buildGridLayout(branchQuestions)
}

/** グリッドレイアウトが横配置モードかどうか */
export function isGridHorizontal<T extends { layoutWidth?: string }>(
  items: T[]
): boolean {
  return items.some((item) => item.layoutWidth != null)
}

/** グリッドセル配列の合計高さ（baseRowHeight単位） */
export function gridTotalHeight<T>(cells: GridCell<T>[]): number {
  if (cells.length === 0) return 0
  return Math.max(...cells.map((c) => c.y + c.height))
}

/** グリッドセルからY区間ごとの右端X座標を計算（ステップ外枠描画用） */
function computeGridRowRightEdges<T>(
  gridCells: GridCell<T>[],
  areaStartY: number,
  areaX: number,
  areaWidth: number,
  baseRowHeight: number
): { yTop: number; yBottom: number; rightX: number }[] {
  const ySet = new Set<number>()
  const absCells: { y: number; yEnd: number; rightX: number }[] = []
  for (const gc of gridCells) {
    const cellY = areaStartY + gc.y * baseRowHeight
    const cellYEnd = cellY + gc.height * baseRowHeight
    const cellRightX = areaX + (gc.x + gc.width) * areaWidth
    ySet.add(cellY)
    ySet.add(cellYEnd)
    absCells.push({ y: cellY, yEnd: cellYEnd, rightX: cellRightX })
  }

  const sortedYs = Array.from(ySet).sort((a, b) => a - b)
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
function computeGridRowLeftEdges<T>(
  gridCells: GridCell<T>[],
  areaStartY: number,
  areaX: number,
  areaWidth: number,
  baseRowHeight: number
): { yTop: number; yBottom: number; leftX: number }[] {
  const ySet = new Set<number>()
  const absCells: { y: number; yEnd: number; leftX: number }[] = []
  for (const gc of gridCells) {
    const cellY = areaStartY + gc.y * baseRowHeight
    const cellYEnd = cellY + gc.height * baseRowHeight
    const cellLeftX = areaX + gc.x * areaWidth
    ySet.add(cellY)
    ySet.add(cellYEnd)
    absCells.push({ y: cellY, yEnd: cellYEnd, leftX: cellLeftX })
  }

  const sortedYs = Array.from(ySet).sort((a, b) => a - b)
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

function computeSubHeight(sub: SubQuestion, baseRowHeight: number): number {
  if (sub.branchQuestions.length > 0) {
    const branchCells = buildBranchGridLayout(sub.branchQuestions)
    return gridTotalHeight(branchCells) * baseRowHeight
  }
  return sub.heightMultiplier * baseRowHeight
}

/**
 * OMR choiceセルのバブル位置を計算（0-1正規化座標）
 */
function computeOMRBubbles(
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  paperWidth: number,
  paperHeight: number,
  config: OMRCellConfig & { type: "choice" }
): ComputedOMRBubble[] {
  const bubbles: ComputedOMRBubble[] = []
  const n = config.numChoices

  const maxRadiusMm = Math.min(cellHeight * 0.25, cellWidth / (n * 2.5 + 1))
  const radiusMm = Math.max(1.5, maxRadiusMm)

  if (config.layout === "horizontal") {
    const spacing = cellWidth / (n + 1)
    const cy = cellY + cellHeight / 2

    for (let i = 0; i < n; i++) {
      const cx = cellX + spacing * (i + 1)
      bubbles.push({
        normalizedCx: cx / paperWidth,
        normalizedCy: cy / paperHeight,
        normalizedRadius: radiusMm / paperWidth,
        choiceIndex: i,
        label: config.labels[i] ?? String(i + 1),
      })
    }
  } else {
    const spacing = cellHeight / (n + 1)
    const cx = cellX + cellWidth / 2

    for (let i = 0; i < n; i++) {
      const cy = cellY + spacing * (i + 1)
      bubbles.push({
        normalizedCx: cx / paperWidth,
        normalizedCy: cy / paperHeight,
        normalizedRadius: radiusMm / paperWidth,
        choiceIndex: i,
        label: config.labels[i] ?? String(i + 1),
      })
    }
  }

  return bubbles
}

/**
 * OMR handwritten-digitセルの数字欄位置を計算（0-1正規化座標）
 */
function computeOMRDigitBoxes(
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  paperWidth: number,
  paperHeight: number,
  config: OMRCellConfig & { type: "handwritten-digit" }
): ComputedOMRDigitBox[] {
  const boxes: ComputedOMRDigitBox[] = []
  const n = config.numDigits

  const boxHeight = cellHeight * 0.8
  const boxWidth = Math.min(boxHeight, cellWidth / (n + 0.5))
  const totalWidth = boxWidth * n
  const startX = cellX + (cellWidth - totalWidth) / 2
  const startY = cellY + (cellHeight - boxHeight) / 2

  for (let i = 0; i < n; i++) {
    boxes.push({
      normalizedX: (startX + boxWidth * i) / paperWidth,
      normalizedY: startY / paperHeight,
      normalizedW: boxWidth / paperWidth,
      normalizedH: boxHeight / paperHeight,
      digitIndex: i,
    })
  }

  return boxes
}

/**
 * セルを作成しOMRバブル/数字欄があれば計算する
 */
function createCell(
  questionPath: number[],
  x: number,
  y: number,
  width: number,
  height: number,
  paper: { width: number; height: number },
  label: string,
  points: number,
  textElements: ComputedCell["textElements"],
  cellType: ComputedCell["cellType"],
  pageIndex: number = 0,
  manuscriptGrid?: ManuscriptGrid,
  omrConfig?: OMRCellConfig
): ComputedCell {
  const cell: ComputedCell = {
    questionPath,
    x,
    y,
    width,
    height,
    normalizedX: x / paper.width,
    normalizedY: y / paper.height,
    normalizedW: width / paper.width,
    normalizedH: height / paper.height,
    label,
    points,
    textElements,
    cellType,
    pageIndex,
    ...(manuscriptGrid ? { manuscriptGrid } : {}),
  }

  if (omrConfig?.type === "choice") {
    cell.omrBubbles = computeOMRBubbles(
      x,
      y,
      width,
      height,
      paper.width,
      paper.height,
      omrConfig
    )
  } else if (omrConfig?.type === "handwritten-digit") {
    cell.omrDigitBoxes = computeOMRDigitBoxes(
      x,
      y,
      width,
      height,
      paper.width,
      paper.height,
      omrConfig
    )
  }

  return cell
}

function computeManuscriptGrid(
  sub: SubQuestion,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number
): ManuscriptGrid | undefined {
  if (!sub.manuscriptPaper?.enabled) return undefined
  const { columns, rows } = sub.manuscriptPaper
  const cellSizeMm = cellHeight / rows
  const gridWidth = columns * cellSizeMm
  const gridHeight = rows * cellSizeMm
  return {
    columns,
    rows,
    cellSizeMm,
    gridX: cellX + (cellWidth - gridWidth) / 2,
    gridY: cellY,
    gridWidth,
    gridHeight,
  }
}

function computeMajorHeight(
  major: MajorQuestion,
  baseRowHeight: number
): number {
  if (isGridHorizontal(major.subQuestions)) {
    const gridCells = buildSubGridLayout(major.subQuestions)
    return gridTotalHeight(gridCells) * baseRowHeight
  }
  return major.subQuestions.reduce(
    (sum, sub) => sum + computeSubHeight(sub, baseRowHeight),
    0
  )
}

/**
 * グリッドセルの空白隣接辺を描画する。
 * renderGridDividerLines は隣接セル間の共有辺のみ、addSteppedBorderLines は外枠のみ描画するため、
 * セルと空白スペースの境界はどちらにも描画されない。この関数がそれを補完する。
 *
 * 各セルの4辺を走査し、「外枠として描画済み」以外の辺を描画する。
 * 共有辺は renderGridDividerLines と重複するが同一スタイル・位置なので視覚的に無害。
 */
function renderGridCompletionLines<
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

    // 右辺: 外枠の rightX と一致するY区間はスキップ
    for (const re of rightEdges) {
      const oTop = Math.max(top, re.yTop)
      const oBottom = Math.min(bottom, re.yBottom)
      if (oBottom <= oTop + 1e-9) continue
      if (Math.abs(right - re.rightX) < 0.01) continue
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

    // 左辺: 外枠の leftX と一致するY区間はスキップ
    for (const le of leftEdges) {
      const oTop = Math.max(top, le.yTop)
      const oBottom = Math.min(bottom, le.yBottom)
      if (oBottom <= oTop + 1e-9) continue
      if (Math.abs(left - le.leftX) < 0.01) continue
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

    // 下辺: グリッド外枠の底辺と一致しない場合のみ
    if (Math.abs(bottom - outerBottom) > 0.01) {
      lines.push({
        x1: left,
        y1: bottom,
        x2: right,
        y2: bottom,
        style: divStyle,
        lineType,
        strokeWidth: sw,
      })
    }

    // 上辺: グリッド外枠の上辺と一致しない場合のみ
    if (Math.abs(top - outerTop) > 0.01) {
      lines.push({
        x1: left,
        y1: top,
        x2: right,
        y2: top,
        style: divStyle,
        lineType,
        strokeWidth: sw,
      })
    }
  }
}

/** グリッドセル間の区切り線を描画 */
function renderGridDividerLines<
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
function renderBranchQuestions(
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
          gc.item.omrConfig
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

    // セルと空白スペースの境界線を補完
    // 枝問グリッドの外枠は親セルの境界（branchAreaX〜contentRight）
    const subBottom = subStartY + gridTotalHeight(branchCells) * baseRowHeight
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
        rightEdges: [
          { yTop: subStartY, yBottom: subBottom, rightX: contentRight },
        ],
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
          branch.omrConfig
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

    // 枝問番号列の右側縦線 → ラベルのある区間は縦線セグメント収集で描画するため、ここでは不要
  }
}

function computeLayoutFromDefinition(
  definition: AnswerSheetDefinition
): ComputedLayout {
  const { settings, majorQuestions } = definition
  const paper = getPaperDimensions(settings)
  const { margins, baseRowHeight, columnWidths, spacing } = settings

  const contentLeft = margins.left
  const contentRight = paper.width - margins.right

  const majorNumX = contentLeft
  const majorNumWidth = columnWidths.majorNumber
  const subNumX = majorNumX + majorNumWidth
  const subNumWidth = columnWidths.subNumber

  const hasBranch = majorQuestions.some((mq) =>
    mq.subQuestions.some((sq) => sq.branchQuestions.length > 0)
  )
  const branchNumX = subNumX + subNumWidth
  const branchNumWidth = hasBranch ? columnWidths.branchNumber : 0

  const cells: ComputedCell[] = []
  const lines: ComputedLine[] = []
  const numberLabels: ComputedNumberLabel[] = []

  // 大問ごとのレイアウト範囲を追跡（外枠描画用）
  const majorLayoutRanges: Array<{
    startY: number
    endY: number
    rowRightEdges: { yTop: number; yBottom: number; rightX: number }[]
    rowLeftEdges: { yTop: number; yBottom: number; leftX: number }[]
  }> = []

  let currentY = margins.top + spacing.headerHeight

  majorQuestions.forEach((major, mi) => {
    if (mi > 0) {
      currentY += spacing.majorQuestionSpacing
    }

    const majorStartY = currentY
    const majorHeight = computeMajorHeight(major, baseRowHeight)
    // 大問ごとの行エッジ追跡
    const majorRightEdges: {
      yTop: number
      yBottom: number
      rightX: number
    }[] = []
    const majorLeftEdges: {
      yTop: number
      yBottom: number
      leftX: number
    }[] = []

    numberLabels.push({
      text: major.label,
      x: majorNumX,
      y: majorStartY,
      width: majorNumWidth,
      height:
        settings.numberDisplayMode === "multirow" ? majorHeight : baseRowHeight,
      fontSize: settings.fonts.majorNumberSize,
      displayMode: settings.numberDisplayMode,
    })

    const horizontalAreaX = majorNumX + majorNumWidth
    const horizontalAreaWidth = contentRight - horizontalAreaX
    const subIsHorizontal = isGridHorizontal(major.subQuestions)

    if (subIsHorizontal) {
      // === 横配置（グリッド）モード ===
      const gridCells = buildSubGridLayout(major.subQuestions)
      for (const gc of gridCells) {
        const cellX = horizontalAreaX + gc.x * horizontalAreaWidth
        const cellWidth = gc.width * horizontalAreaWidth
        const cellY = majorStartY + gc.y * baseRowHeight
        const cellHeight = gc.height * baseRowHeight
        const sub = gc.item
        const hasBranches = sub.branchQuestions.length > 0
        const effSubNumW = sub.label === "" ? 0 : subNumWidth

        if (effSubNumW > 0) {
          numberLabels.push({
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
            mi,
            gc.itemIndex,
            major.label,
            cellY,
            0,
            cellX,
            effSubNumW,
            cellBranchNumX,
            cellBranchNumWidth,
            cellAnswerX,
            cellAnswerWidth,
            cellRight,
            baseRowHeight,
            paper,
            settings,
            cells,
            lines,
            numberLabels,
            majorRightEdges
          )
        } else {
          cells.push(
            createCell(
              [mi, gc.itemIndex],
              cellX + effSubNumW,
              cellY,
              cellWidth - effSubNumW,
              cellHeight,
              paper,
              `${major.label}-${sub.label}`,
              sub.points,
              sub.textElements,
              "answer",
              0,
              computeManuscriptGrid(
                sub,
                cellX + effSubNumW,
                cellY,
                cellWidth - effSubNumW,
                cellHeight
              ),
              sub.omrConfig
            )
          )
        }

        // 番号ラベル右側の区切り線
        if (effSubNumW > 0) {
          lines.push({
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

      // rowRightEdges: Y区間ごとの右端X座標を計算
      for (const edge of computeGridRowRightEdges(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight
      )) {
        majorRightEdges.push(edge)
      }

      // rowLeftEdges: Y区間ごとの左端X座標を計算
      for (const edge of computeGridRowLeftEdges(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight
      )) {
        majorLeftEdges.push({
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
        lines,
        "sub"
      )

      const majorEndY = majorStartY + gridTotalHeight(gridCells) * baseRowHeight

      // セルと空白スペースの境界線を補完
      // 小問グリッドの外枠は addSteppedBorderLines で描画されるため、
      // 外枠と一致する辺はスキップする
      const subRightEdges = computeGridRowRightEdges(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight
      )
      const subLeftEdges = computeGridRowLeftEdges(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight
      )
      renderGridCompletionLines(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight,
        settings,
        lines,
        "sub",
        {
          top: majorStartY,
          bottom: majorEndY,
          rightEdges: subRightEdges,
          leftEdges: subLeftEdges,
        }
      )

      // 横配置モード: 大問番号枠を独立した長方形として描画
      const outerSw = getLineWidth("outer", settings.borderConfig)
      // 左辺
      lines.push({
        x1: contentLeft,
        y1: majorStartY,
        x2: contentLeft,
        y2: majorEndY,
        style: settings.borderConfig.outerBorder,
        strokeWidth: outerSw,
        lineType: "outer",
      })
      // 右辺
      lines.push({
        x1: horizontalAreaX,
        y1: majorStartY,
        x2: horizontalAreaX,
        y2: majorEndY,
        style: settings.borderConfig.outerBorder,
        strokeWidth: outerSw,
        lineType: "outer",
      })
      // 上辺
      lines.push({
        x1: contentLeft,
        y1: majorStartY,
        x2: horizontalAreaX,
        y2: majorStartY,
        style: settings.borderConfig.outerBorder,
        strokeWidth: outerSw,
        lineType: "outer",
      })
      // 下辺
      lines.push({
        x1: contentLeft,
        y1: majorEndY,
        x2: horizontalAreaX,
        y2: majorEndY,
        style: settings.borderConfig.outerBorder,
        strokeWidth: outerSw,
        lineType: "outer",
      })

      currentY = majorEndY
    } else {
      // === 縦配置モード ===
      major.subQuestions.forEach((sub, si) => {
        const subStartY = currentY
        const hasBranches = sub.branchQuestions.length > 0
        const subHeight = computeSubHeight(sub, baseRowHeight)
        const effSubNumW = sub.label === "" ? 0 : subNumWidth
        const effBranchNumX = subNumX + effSubNumW
        const effAnswerX = effBranchNumX + branchNumWidth
        const effAnswerWidth = contentRight - effAnswerX

        if (effSubNumW > 0) {
          numberLabels.push({
            text: sub.label,
            x: subNumX,
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
            mi,
            si,
            major.label,
            subStartY,
            0,
            subNumX,
            effSubNumW,
            effBranchNumX,
            branchNumWidth,
            effAnswerX,
            effAnswerWidth,
            contentRight,
            baseRowHeight,
            paper,
            settings,
            cells,
            lines,
            numberLabels,
            majorRightEdges
          )
        } else {
          cells.push(
            createCell(
              [mi, si],
              effAnswerX,
              subStartY,
              effAnswerWidth,
              subHeight,
              paper,
              `${major.label}-${sub.label}`,
              sub.points,
              sub.textElements,
              "answer",
              0,
              computeManuscriptGrid(
                sub,
                effAnswerX,
                subStartY,
                effAnswerWidth,
                subHeight
              ),
              sub.omrConfig
            )
          )
        }

        // vertical-sub行の右端は常にcontentRight
        majorRightEdges.push({
          yTop: subStartY,
          yBottom: subStartY + subHeight,
          rightX: contentRight,
        })
        // vertical-sub行の左端は常にcontentLeft
        majorLeftEdges.push({
          yTop: subStartY,
          yBottom: subStartY + subHeight,
          leftX: contentLeft,
        })

        currentY += subHeight

        // 行間の区切り線（最後の行以外）
        if (si < major.subQuestions.length - 1) {
          lines.push({
            x1: subNumX,
            y1: currentY,
            x2: contentRight,
            y2: currentY,
            style: settings.borderConfig.subDivider,
            lineType: "sub",
            strokeWidth: getLineWidth("sub", settings.borderConfig),
            dragInfo: {
              axis: "horizontal",
              target: {
                type: "heightMultiplier",
                majorIndex: mi,
                subIndex: si,
              },
              currentValueMm: hasBranches
                ? sub.branchQuestions.reduce(
                    (s, bq) => s + bq.heightMultiplier * baseRowHeight,
                    0
                  )
                : sub.heightMultiplier * baseRowHeight,
              minMm: baseRowHeight * 0.5,
            },
          })
        }
      })
    }

    majorLayoutRanges.push({
      startY: majorStartY,
      endY: currentY,
      rowRightEdges: majorRightEdges,
      rowLeftEdges: majorLeftEdges,
    })

    if (spacing.majorQuestionSpacing === 0 && mi < majorQuestions.length - 1) {
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
  const contentTop = margins.top + spacing.headerHeight

  // 外枠（ステップ形状対応）
  if (spacing.majorQuestionSpacing > 0 && majorLayoutRanges.length > 1) {
    // 大問間に間隔がある場合: 大問ごとに独立した外枠を描画
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
    // 間隔なし or 大問1つ: 全体を1つの外枠で囲む
    const allRightEdges = majorLayoutRanges.flatMap((r) => r.rowRightEdges)
    const allLeftEdges = majorLayoutRanges.flatMap((r) => r.rowLeftEdges)
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

  // vertical-sub 行のY範囲を収集（小問番号列セグメント化用）
  // branchVerticalRanges: vertical-branch行のY範囲（枝問番号列用）
  // horizontalMajorRanges: 横配置大問のY範囲（大問番号列縦線セグメント化用）
  const verticalRanges: { top: number; bottom: number }[] = []
  const branchVerticalRanges: { top: number; bottom: number }[] = []
  const horizontalMajorRanges: { top: number; bottom: number }[] = []
  {
    let trackY = margins.top + spacing.headerHeight
    for (let mi2 = 0; mi2 < majorQuestions.length; mi2++) {
      const mq = majorQuestions[mi2]
      if (mi2 > 0) {
        trackY += spacing.majorQuestionSpacing
      }

      if (isGridHorizontal(mq.subQuestions)) {
        // 横配置モード: 小問番号列は不要
        const gridCells = buildSubGridLayout(mq.subQuestions)
        const height = gridTotalHeight(gridCells) * baseRowHeight
        horizontalMajorRanges.push({ top: trackY, bottom: trackY + height })
        trackY += height
      } else {
        // 縦配置モード: ラベルのある小問の区間だけ小問番号列セグメントを収集
        let subSegStart: number | null = null
        for (const sub of mq.subQuestions) {
          const subH = computeSubHeight(sub, baseRowHeight)
          if (sub.label !== "") {
            if (subSegStart === null) subSegStart = trackY
          } else {
            if (subSegStart !== null) {
              verticalRanges.push({ top: subSegStart, bottom: trackY })
              subSegStart = null
            }
          }
          // 枝問番号列のセグメント: ラベルのある枝問の区間だけ
          if (sub.branchQuestions.length > 0) {
            if (!isGridHorizontal(sub.branchQuestions)) {
              let branchSegStart: number | null = null
              let branchY = trackY
              for (const bq of sub.branchQuestions) {
                const bqH = bq.heightMultiplier * baseRowHeight
                if (bq.label !== "") {
                  if (branchSegStart === null) branchSegStart = branchY
                } else {
                  if (branchSegStart !== null) {
                    branchVerticalRanges.push({
                      top: branchSegStart,
                      bottom: branchY,
                    })
                    branchSegStart = null
                  }
                }
                branchY += bqH
              }
              if (branchSegStart !== null) {
                branchVerticalRanges.push({
                  top: branchSegStart,
                  bottom: branchY,
                })
              }
            }
            // 横配置の場合は枝問番号列は不要（個別セル内に番号を表示）
          }
          trackY += subH
        }
        if (subSegStart !== null) {
          verticalRanges.push({ top: subSegStart, bottom: trackY })
        }
      }
    }
  }

  // 大問番号列の縦線 → 横配置大問の範囲とスペーシング部分を除外
  const majorNcSw = getLineWidth("majorNumberColumn", settings.borderConfig)
  const majorNumLineX = majorNumX + majorNumWidth
  {
    // 除外範囲を構築: 横配置大問の範囲 + 大問間スペーシング
    const majorColExcludeRanges = [...horizontalMajorRanges]
    if (spacing.majorQuestionSpacing > 0) {
      for (let i = 0; i < majorLayoutRanges.length - 1; i++) {
        majorColExcludeRanges.push({
          top: majorLayoutRanges[i].endY,
          bottom: majorLayoutRanges[i + 1].startY,
        })
      }
      majorColExcludeRanges.sort((a, b) => a.top - b.top)
    }
    let segStart = contentTop
    let isFirst = true
    for (const range of majorColExcludeRanges) {
      if (segStart < range.top - 0.01) {
        lines.push({
          x1: majorNumLineX,
          y1: segStart,
          x2: majorNumLineX,
          y2: range.top,
          style: settings.borderConfig.majorNumberDivider,
          lineType: "majorNumberColumn",
          strokeWidth: majorNcSw,
          ...(isFirst
            ? {
                dragInfo: {
                  axis: "vertical" as const,
                  target: {
                    type: "columnWidth" as const,
                    column: "majorNumber" as const,
                  },
                  currentValueMm: majorNumWidth,
                  minMm: 5,
                },
              }
            : {}),
        })
        isFirst = false
      }
      segStart = range.bottom
    }
    if (segStart < contentBottom - 0.01) {
      lines.push({
        x1: majorNumLineX,
        y1: segStart,
        x2: majorNumLineX,
        y2: contentBottom,
        style: settings.borderConfig.majorNumberDivider,
        lineType: "majorNumberColumn",
        strokeWidth: majorNcSw,
        ...(isFirst
          ? {
              dragInfo: {
                axis: "vertical" as const,
                target: {
                  type: "columnWidth" as const,
                  column: "majorNumber" as const,
                },
                currentValueMm: majorNumWidth,
                minMm: 5,
              },
            }
          : {}),
      })
    }
  }

  // 小問番号列の縦線 → 縦配置のセグメントのみ
  const subNcSw = getLineWidth("subNumberColumn", settings.borderConfig)
  for (const range of verticalRanges) {
    lines.push({
      x1: subNumX + subNumWidth,
      y1: range.top,
      x2: subNumX + subNumWidth,
      y2: range.bottom,
      style: settings.borderConfig.subNumberDivider,
      lineType: "subNumberColumn",
      strokeWidth: subNcSw,
      dragInfo: {
        axis: "vertical",
        target: { type: "columnWidth", column: "subNumber" },
        currentValueMm: subNumWidth,
        minMm: 5,
      },
    })
  }

  // 枝問番号列の縦線 → vertical-branchセグメントのみ
  if (hasBranch) {
    const branchNcSw = getLineWidth("branchNumberColumn", settings.borderConfig)
    for (const range of branchVerticalRanges) {
      lines.push({
        x1: branchNumX + branchNumWidth,
        y1: range.top,
        x2: branchNumX + branchNumWidth,
        y2: range.bottom,
        style: settings.borderConfig.branchNumberDivider,
        lineType: "branchNumberColumn",
        strokeWidth: branchNcSw,
        dragInfo: {
          axis: "vertical",
          target: { type: "columnWidth", column: "branchNumber" },
          currentValueMm: branchNumWidth,
          minMm: 5,
        },
      })
    }
  }

  // OMRマーカー
  const omrMarkerPositions = computeOMRMarkers(settings, paper)

  return {
    pageWidthMm: paper.width,
    pageHeightMm: paper.height,
    cells,
    lines,
    numberLabels,
    omrMarkerPositions,
    overflow: contentBottom > paper.height - margins.bottom,
    contentHeightMm: contentBottom - margins.top,
  }
}

function addBorderLines(
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
function addSteppedBorderLines(
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
    // 通常の矩形外枠
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
        // 垂直線: curLeftX で curLeftY → edge.yTop
        lines.push({
          x1: curLeftX,
          y1: curLeftY,
          x2: curLeftX,
          y2: edge.yTop,
          style,
          lineType: "outer",
          strokeWidth: sw,
        })
        // 水平線: curLeftX → edge.leftX at edge.yTop
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

    // 最後の区間の下端まで左辺を描画
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
      // 垂直線: curRightX で curY → edge.yTop
      lines.push({
        x1: curRightX,
        y1: curY,
        x2: curRightX,
        y2: edge.yTop,
        style,
        lineType: "outer",
        strokeWidth: sw,
      })
      // 水平線: curRightX → edge.rightX at edge.yTop
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

  // 最後の行の下端まで右辺を描画
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

function computeOMRMarkers(
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

export function computeMultiPageLayoutFromDefinition(
  definition: AnswerSheetDefinition
): ComputedMultiPageLayout {
  const { settings, majorQuestions } = definition
  const paper = getPaperDimensions(settings)
  const { margins, baseRowHeight, columnWidths, spacing } = settings

  const contentLeft = margins.left
  const contentRight = paper.width - margins.right
  const contentTop = margins.top + spacing.headerHeight
  const contentMaxY = paper.height - margins.bottom

  const majorNumX = contentLeft
  const majorNumWidth = columnWidths.majorNumber
  const subNumX = majorNumX + majorNumWidth
  const subNumWidth = columnWidths.subNumber

  const hasBranch = majorQuestions.some((mq) =>
    mq.subQuestions.some((sq) => sq.branchQuestions.length > 0)
  )
  const branchNumX = subNumX + subNumWidth
  const branchNumWidth = hasBranch ? columnWidths.branchNumber : 0

  interface PageData {
    cells: ComputedCell[]
    lines: ComputedLine[]
    numberLabels: ComputedNumberLabel[]
    verticalRanges: { top: number; bottom: number }[]
    branchVerticalRanges: { top: number; bottom: number }[]
    /** 横配置大問のY範囲（大問番号列縦線セグメント化用） */
    horizontalMajorRanges: { top: number; bottom: number }[]
    rowRightEdges: { yTop: number; yBottom: number; rightX: number }[]
    rowLeftEdges: { yTop: number; yBottom: number; leftX: number }[]
    /** 大問ごとのレイアウト範囲（大問間スペーシング時の個別外枠描画用） */
    majorLayoutRanges: Array<{
      startY: number
      endY: number
      rowRightEdges: { yTop: number; yBottom: number; rightX: number }[]
      rowLeftEdges: { yTop: number; yBottom: number; leftX: number }[]
    }>
    contentBottomY: number
  }

  function newPageData(): PageData {
    return {
      cells: [],
      lines: [],
      numberLabels: [],
      verticalRanges: [],
      branchVerticalRanges: [],
      horizontalMajorRanges: [],
      rowRightEdges: [],
      rowLeftEdges: [],
      majorLayoutRanges: [],
      contentBottomY: contentTop,
    }
  }

  const pagesData: PageData[] = [newPageData()]
  let currentPageIdx = 0
  let currentY = contentTop

  function layoutMajorOnPage(
    page: PageData,
    major: MajorQuestion,
    mi: number,
    startY: number,
    pageIdx: number
  ): number {
    let localY = startY
    const majorStartY = localY
    const majorHeight = computeMajorHeight(major, baseRowHeight)

    // 大問番号ラベル
    page.numberLabels.push({
      text: major.label,
      x: majorNumX,
      y: majorStartY,
      width: majorNumWidth,
      height:
        settings.numberDisplayMode === "multirow" ? majorHeight : baseRowHeight,
      fontSize: settings.fonts.majorNumberSize,
      displayMode: settings.numberDisplayMode,
    })

    const horizontalAreaX = majorNumX + majorNumWidth
    const horizontalAreaWidth = contentRight - horizontalAreaX
    const subIsHorizontal = isGridHorizontal(major.subQuestions)

    if (subIsHorizontal) {
      // === 横配置（グリッド）モード ===
      const gridCells = buildSubGridLayout(major.subQuestions)
      for (const gc of gridCells) {
        const cellX = horizontalAreaX + gc.x * horizontalAreaWidth
        const cellWidth = gc.width * horizontalAreaWidth
        const cellY = majorStartY + gc.y * baseRowHeight
        const cellHeight = gc.height * baseRowHeight
        const sub = gc.item
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
          const cellBranchNumX = cellX + effSubNumW
          const cellBranchNumWidth = branchNumWidth
          const cellAnswerX = cellBranchNumX + cellBranchNumWidth
          const cellAnswerWidth = cellWidth - effSubNumW - cellBranchNumWidth
          const cellRight = cellX + cellWidth
          renderBranchQuestions(
            sub,
            mi,
            gc.itemIndex,
            major.label,
            cellY,
            pageIdx,
            cellX,
            effSubNumW,
            cellBranchNumX,
            cellBranchNumWidth,
            cellAnswerX,
            cellAnswerWidth,
            cellRight,
            baseRowHeight,
            paper,
            settings,
            page.cells,
            page.lines,
            page.numberLabels,
            page.rowRightEdges
          )
        } else {
          page.cells.push(
            createCell(
              [mi, gc.itemIndex],
              cellX + effSubNumW,
              cellY,
              cellWidth - effSubNumW,
              cellHeight,
              paper,
              `${major.label}-${sub.label}`,
              sub.points,
              sub.textElements,
              "answer",
              pageIdx,
              computeManuscriptGrid(
                sub,
                cellX + effSubNumW,
                cellY,
                cellWidth - effSubNumW,
                cellHeight
              ),
              sub.omrConfig
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

      // rowRightEdges: Y区間ごとの右端X座標を計算
      for (const edge of computeGridRowRightEdges(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight
      )) {
        page.rowRightEdges.push(edge)
      }

      // rowLeftEdges: Y区間ごとの左端X座標を計算
      for (const edge of computeGridRowLeftEdges(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight
      )) {
        page.rowLeftEdges.push({
          yTop: edge.yTop,
          yBottom: edge.yBottom,
          leftX: edge.leftX,
        })
      }

      // グリッドセル間の区切り線
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

      // セルと空白スペースの境界線を補完
      const subRightEdges = computeGridRowRightEdges(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight
      )
      const subLeftEdges = computeGridRowLeftEdges(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight
      )
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
          rightEdges: subRightEdges,
          leftEdges: subLeftEdges,
        }
      )

      // 横配置モード: 大問番号枠を独立した長方形として描画
      const outerSw = getLineWidth("outer", settings.borderConfig)
      page.lines.push(
        {
          x1: contentLeft,
          y1: majorStartY,
          x2: contentLeft,
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
          x1: contentLeft,
          y1: majorStartY,
          x2: horizontalAreaX,
          y2: majorStartY,
          style: settings.borderConfig.outerBorder,
          strokeWidth: outerSw,
          lineType: "outer",
        },
        {
          x1: contentLeft,
          y1: majorEndY,
          x2: horizontalAreaX,
          y2: majorEndY,
          style: settings.borderConfig.outerBorder,
          strokeWidth: outerSw,
          lineType: "outer",
        }
      )

      // 横配置大問のY範囲を記録（大問番号列縦線のセグメント化用）
      page.horizontalMajorRanges.push({ top: majorStartY, bottom: majorEndY })

      localY = majorEndY
    } else {
      // === 縦配置モード ===
      const vertSegStart = localY
      major.subQuestions.forEach((sub, si) => {
        const subStartY = localY
        const hasBranches = sub.branchQuestions.length > 0
        const subHeight = computeSubHeight(sub, baseRowHeight)
        const effSubNumW = sub.label === "" ? 0 : subNumWidth
        const effBranchNumX = subNumX + effSubNumW
        const effAnswerX = effBranchNumX + branchNumWidth
        const effAnswerWidth = contentRight - effAnswerX

        if (effSubNumW > 0) {
          page.numberLabels.push({
            text: sub.label,
            x: subNumX,
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
            mi,
            si,
            major.label,
            subStartY,
            pageIdx,
            subNumX,
            effSubNumW,
            effBranchNumX,
            branchNumWidth,
            effAnswerX,
            effAnswerWidth,
            contentRight,
            baseRowHeight,
            paper,
            settings,
            page.cells,
            page.lines,
            page.numberLabels,
            page.rowRightEdges
          )

          // 枝問番号列のセグメント（ラベルのある枝問のみ）
          if (!isGridHorizontal(sub.branchQuestions)) {
            let branchSegStart: number | null = null
            let branchY = subStartY
            for (const bq of sub.branchQuestions) {
              const bqH = bq.heightMultiplier * baseRowHeight
              if (bq.label !== "") {
                if (branchSegStart === null) branchSegStart = branchY
              } else {
                if (branchSegStart !== null) {
                  page.branchVerticalRanges.push({
                    top: branchSegStart,
                    bottom: branchY,
                  })
                  branchSegStart = null
                }
              }
              branchY += bqH
            }
            if (branchSegStart !== null) {
              page.branchVerticalRanges.push({
                top: branchSegStart,
                bottom: branchY,
              })
            }
          }
        } else {
          page.cells.push(
            createCell(
              [mi, si],
              effAnswerX,
              subStartY,
              effAnswerWidth,
              subHeight,
              paper,
              `${major.label}-${sub.label}`,
              sub.points,
              sub.textElements,
              "answer",
              pageIdx,
              computeManuscriptGrid(
                sub,
                effAnswerX,
                subStartY,
                effAnswerWidth,
                subHeight
              ),
              sub.omrConfig
            )
          )
        }

        // vertical-sub行の右端は常にcontentRight
        page.rowRightEdges.push({
          yTop: subStartY,
          yBottom: subStartY + subHeight,
          rightX: contentRight,
        })
        // vertical-sub行の左端は常にcontentLeft
        page.rowLeftEdges.push({
          yTop: subStartY,
          yBottom: subStartY + subHeight,
          leftX: contentLeft,
        })

        localY += subHeight

        // 行間の区切り線（最後の行以外）
        if (si < major.subQuestions.length - 1) {
          page.lines.push({
            x1: subNumX,
            y1: localY,
            x2: contentRight,
            y2: localY,
            style: settings.borderConfig.subDivider,
            lineType: "sub",
            strokeWidth: getLineWidth("sub", settings.borderConfig),
          })
        }
      })

      // 小問番号列セグメント: ラベルのある小問の区間だけ
      {
        let subSegStart: number | null = null
        let subTrackY = vertSegStart
        for (const sub of major.subQuestions) {
          const subH = computeSubHeight(sub, baseRowHeight)
          if (sub.label !== "") {
            if (subSegStart === null) subSegStart = subTrackY
          } else {
            if (subSegStart !== null) {
              page.verticalRanges.push({ top: subSegStart, bottom: subTrackY })
              subSegStart = null
            }
          }
          subTrackY += subH
        }
        if (subSegStart !== null) {
          page.verticalRanges.push({ top: subSegStart, bottom: subTrackY })
        }
      }
    }

    return localY
  }

  // 大問を順番に配置
  for (let mi = 0; mi < majorQuestions.length; mi++) {
    const major = majorQuestions[mi]
    const majorHeight = computeMajorHeight(major, baseRowHeight)
    const spacingHeight =
      mi > 0 && currentY > contentTop ? spacing.majorQuestionSpacing : 0

    if (
      currentY + spacingHeight + majorHeight > contentMaxY &&
      currentY > contentTop
    ) {
      pagesData[currentPageIdx].contentBottomY = currentY
      currentPageIdx++
      pagesData.push(newPageData())
      currentY = contentTop
    } else {
      currentY += spacingHeight
    }

    const majorStartY = currentY
    // エッジ追跡: layoutMajorOnPage前のスナップショット
    const page = pagesData[currentPageIdx]
    const rightEdgesBefore = page.rowRightEdges.length
    const leftEdgesBefore = page.rowLeftEdges.length

    currentY = layoutMajorOnPage(page, major, mi, currentY, currentPageIdx)

    // この大問で追加されたエッジを取得して大問範囲として保存
    page.majorLayoutRanges.push({
      startY: majorStartY,
      endY: currentY,
      rowRightEdges: page.rowRightEdges.slice(rightEdgesBefore),
      rowLeftEdges: page.rowLeftEdges.slice(leftEdgesBefore),
    })

    if (spacing.majorQuestionSpacing === 0 && mi < majorQuestions.length - 1) {
      page.lines.push({
        x1: contentLeft,
        y1: currentY,
        x2: contentRight,
        y2: currentY,
        style: settings.borderConfig.majorDivider,
        lineType: "major",
        strokeWidth: getLineWidth("major", settings.borderConfig),
      })
    }
  }

  pagesData[currentPageIdx].contentBottomY = currentY

  // ページごとにborder線・番号列線・OMRマーカーを追加
  const pages: ComputedPageLayout[] = pagesData.map((pd, idx) => {
    const pageContentBottom = pd.contentBottomY

    // ページ末尾の大問区切り線を削除
    const lastLine = pd.lines[pd.lines.length - 1]
    if (
      lastLine &&
      lastLine.lineType === "major" &&
      Math.abs(lastLine.y1 - pageContentBottom) < 0.01
    ) {
      pd.lines.pop()
    }

    // 外枠線（ステップ形状対応）
    if (spacing.majorQuestionSpacing > 0 && pd.majorLayoutRanges.length > 1) {
      // 大問間に間隔がある場合: 大問ごとに独立した外枠を描画
      for (const range of pd.majorLayoutRanges) {
        addSteppedBorderLines(
          pd.lines,
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
      // 間隔なし or 大問1つ: 全体を1つの外枠で囲む
      addSteppedBorderLines(
        pd.lines,
        contentLeft,
        contentTop,
        contentRight,
        pageContentBottom,
        settings.borderConfig.outerBorder,
        settings.borderConfig,
        pd.rowRightEdges,
        pd.rowLeftEdges
      )
    }

    // 大問番号列の縦線（横配置大問の範囲とスペーシング部分を除外）
    {
      const majorNcSwPage = getLineWidth(
        "majorNumberColumn",
        settings.borderConfig
      )
      const majorNumLineX = majorNumX + majorNumWidth
      // 除外範囲を構築
      const majorColExcludeRanges = [...pd.horizontalMajorRanges]
      if (spacing.majorQuestionSpacing > 0) {
        for (let i = 0; i < pd.majorLayoutRanges.length - 1; i++) {
          majorColExcludeRanges.push({
            top: pd.majorLayoutRanges[i].endY,
            bottom: pd.majorLayoutRanges[i + 1].startY,
          })
        }
        majorColExcludeRanges.sort((a, b) => a.top - b.top)
      }
      let segStart = contentTop
      for (const range of majorColExcludeRanges) {
        if (segStart < range.top - 0.01) {
          pd.lines.push({
            x1: majorNumLineX,
            y1: segStart,
            x2: majorNumLineX,
            y2: range.top,
            style: settings.borderConfig.majorNumberDivider,
            lineType: "majorNumberColumn",
            strokeWidth: majorNcSwPage,
          })
        }
        segStart = range.bottom
      }
      if (segStart < pageContentBottom - 0.01) {
        pd.lines.push({
          x1: majorNumLineX,
          y1: segStart,
          x2: majorNumLineX,
          y2: pageContentBottom,
          style: settings.borderConfig.majorNumberDivider,
          lineType: "majorNumberColumn",
          strokeWidth: majorNcSwPage,
        })
      }
    }

    // 小問番号列の縦線（縦配置セグメントのみ）
    {
      const subNcSwPage = getLineWidth("subNumberColumn", settings.borderConfig)
      for (const range of pd.verticalRanges) {
        pd.lines.push({
          x1: subNumX + subNumWidth,
          y1: range.top,
          x2: subNumX + subNumWidth,
          y2: range.bottom,
          style: settings.borderConfig.subNumberDivider,
          lineType: "subNumberColumn",
          strokeWidth: subNcSwPage,
        })
      }
    }

    // 枝問番号列の縦線（vertical-branchセグメントのみ）
    if (hasBranch) {
      const branchNcSwPage = getLineWidth(
        "branchNumberColumn",
        settings.borderConfig
      )
      for (const range of pd.branchVerticalRanges) {
        pd.lines.push({
          x1: branchNumX + branchNumWidth,
          y1: range.top,
          x2: branchNumX + branchNumWidth,
          y2: range.bottom,
          style: settings.borderConfig.branchNumberDivider,
          lineType: "branchNumberColumn",
          strokeWidth: branchNcSwPage,
        })
      }
    }

    const omrMarkerPositions = computeOMRMarkers(settings, paper)

    return {
      pageIndex: idx,
      cells: pd.cells,
      lines: pd.lines,
      numberLabels: pd.numberLabels,
      omrMarkerPositions,
      contentHeightMm: pageContentBottom - margins.top,
    }
  })

  return {
    pages,
    totalPages: pages.length,
    pageWidthMm: paper.width,
    pageHeightMm: paper.height,
  }
}

/** 単一ページレイアウト（後方互換） */
export function useAnswerSheetLayout(
  definition: AnswerSheetDefinition
): ComputedLayout {
  return useMemo(() => computeLayoutFromDefinition(definition), [definition])
}

/** 複数ページレイアウト */
export function useMultiPageLayout(
  definition: AnswerSheetDefinition
): ComputedMultiPageLayout {
  return useMemo(
    () => computeMultiPageLayoutFromDefinition(definition),
    [definition]
  )
}
