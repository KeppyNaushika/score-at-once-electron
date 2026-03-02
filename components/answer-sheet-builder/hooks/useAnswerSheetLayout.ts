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
    case "numberColumn":
      return borderConfig.numberColumnDividerWidth ?? 0.4
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
function parseFraction(s: string): number {
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
function buildGridLayout<
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
function isGridHorizontal<T extends { layoutWidth?: string }>(
  items: T[]
): boolean {
  return items.some((item) => item.layoutWidth != null)
}

/** グリッドセル配列の合計高さ（baseRowHeight単位） */
function gridTotalHeight<T>(cells: GridCell<T>[]): number {
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

function computeSubHeight(sub: SubQuestion, baseRowHeight: number): number {
  if (sub.branchQuestions.length > 0) {
    const branchCells = buildBranchGridLayout(sub.branchQuestions)
    return gridTotalHeight(branchCells) * baseRowHeight
  }
  if (sub.manuscriptPaper?.enabled) {
    return sub.manuscriptPaper.rows * sub.manuscriptPaper.cellSizeMm
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
  modelAnswer: string | undefined,
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
    modelAnswer,
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
  cellWidth: number
): ManuscriptGrid | undefined {
  if (!sub.manuscriptPaper?.enabled) return undefined
  const { columns, rows, cellSizeMm } = sub.manuscriptPaper
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

      numberLabels.push({
        text: gc.item.label,
        x: cellX,
        y: cellY,
        width: branchNumWidth,
        height: cellHeight,
        fontSize: settings.fonts.numberSize - 1,
        displayMode: "branch-horizontal",
      })

      cells.push(
        createCell(
          [mi, si, gc.itemIndex],
          cellX + branchNumWidth,
          cellY,
          cellWidth - branchNumWidth,
          cellHeight,
          paper,
          `${majorLabel}-${sub.label}-${gc.item.label}`,
          gc.item.points,
          gc.item.textElements,
          gc.item.modelAnswer,
          "answer",
          pageIndex,
          undefined,
          gc.item.omrConfig
        )
      )

      // 番号ラベル右側の区切り線
      lines.push({
        x1: cellX + branchNumWidth,
        y1: cellY,
        x2: cellX + branchNumWidth,
        y2: cellY + cellHeight,
        style: settings.borderConfig.numberColumnDivider,
        lineType: "numberColumn",
        strokeWidth: getLineWidth("numberColumn", settings.borderConfig),
      })
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
  } else {
    // 縦配置
    let branchY = subStartY
    sub.branchQuestions.forEach((branch, bi) => {
      const branchHeight = branch.heightMultiplier * baseRowHeight

      numberLabels.push({
        text: branch.label,
        x: branchNumX,
        y: branchY,
        width: branchNumWidth,
        height: branchHeight,
        fontSize: settings.fonts.numberSize - 1,
        displayMode: "branch",
      })

      cells.push(
        createCell(
          [mi, si, bi],
          answerX,
          branchY,
          answerWidth,
          branchHeight,
          paper,
          `${majorLabel}-${sub.label}-${branch.label}`,
          branch.points,
          branch.textElements,
          branch.modelAnswer,
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

  const answerX = branchNumX + branchNumWidth
  const answerWidth = contentRight - answerX

  const cells: ComputedCell[] = []
  const lines: ComputedLine[] = []
  const numberLabels: ComputedNumberLabel[] = []

  // 各行の右端X座標を追跡（ステップ外枠描画用）
  const rowRightEdges: { yTop: number; yBottom: number; rightX: number }[] = []

  let currentY = margins.top + spacing.headerHeight

  majorQuestions.forEach((major, mi) => {
    if (mi > 0) {
      // 大問間スペーシング: 前後の大問のrightXを維持
      const spacingTop = currentY
      currentY += spacing.majorQuestionSpacing
      rowRightEdges.push({
        yTop: spacingTop,
        yBottom: currentY,
        rightX: contentRight,
      })
    }

    const majorStartY = currentY
    const majorHeight = computeMajorHeight(major, baseRowHeight)

    numberLabels.push({
      text: major.label,
      x: majorNumX,
      y: majorStartY,
      width: majorNumWidth,
      height:
        settings.numberDisplayMode === "multirow" ? majorHeight : baseRowHeight,
      fontSize: settings.fonts.numberSize,
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

        numberLabels.push({
          text: sub.label,
          x: cellX,
          y: cellY,
          width: subNumWidth,
          height: cellHeight,
          fontSize: settings.fonts.numberSize,
          displayMode: "sub-horizontal",
        })

        if (hasBranches) {
          // 枝問をセル内でレンダリング
          const cellBranchNumX = cellX + subNumWidth
          const cellBranchNumWidth = branchNumWidth
          const cellAnswerX = cellBranchNumX + cellBranchNumWidth
          const cellAnswerWidth = cellWidth - subNumWidth - cellBranchNumWidth
          const cellRight = cellX + cellWidth
          renderBranchQuestions(
            sub,
            mi,
            gc.itemIndex,
            major.label,
            cellY,
            0,
            cellX,
            subNumWidth,
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
            rowRightEdges
          )
        } else {
          cells.push(
            createCell(
              [mi, gc.itemIndex],
              cellX + subNumWidth,
              cellY,
              cellWidth - subNumWidth,
              cellHeight,
              paper,
              `${major.label}-${sub.label}`,
              sub.points,
              sub.textElements,
              sub.modelAnswer,
              "answer",
              0,
              computeManuscriptGrid(
                sub,
                cellX + subNumWidth,
                cellY,
                cellWidth - subNumWidth
              ),
              sub.omrConfig
            )
          )
        }

        // 番号ラベル右側の区切り線
        lines.push({
          x1: cellX + subNumWidth,
          y1: cellY,
          x2: cellX + subNumWidth,
          y2: cellY + cellHeight,
          style: settings.borderConfig.numberColumnDivider,
          lineType: "numberColumn",
          strokeWidth: getLineWidth("numberColumn", settings.borderConfig),
        })
      }

      // rowRightEdges: Y区間ごとの右端X座標を計算
      for (const edge of computeGridRowRightEdges(
        gridCells,
        majorStartY,
        horizontalAreaX,
        horizontalAreaWidth,
        baseRowHeight
      )) {
        rowRightEdges.push(edge)
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

      currentY = majorStartY + gridTotalHeight(gridCells) * baseRowHeight
    } else {
      // === 縦配置モード ===
      major.subQuestions.forEach((sub, si) => {
        const subStartY = currentY
        const hasBranches = sub.branchQuestions.length > 0
        const subHeight = computeSubHeight(sub, baseRowHeight)

        numberLabels.push({
          text: sub.label,
          x: subNumX,
          y: subStartY,
          width: subNumWidth,
          height: subHeight,
          fontSize: settings.fonts.numberSize,
          displayMode: "sub",
        })

        if (hasBranches) {
          renderBranchQuestions(
            sub,
            mi,
            si,
            major.label,
            subStartY,
            0,
            subNumX,
            subNumWidth,
            branchNumX,
            branchNumWidth,
            answerX,
            answerWidth,
            contentRight,
            baseRowHeight,
            paper,
            settings,
            cells,
            lines,
            numberLabels,
            rowRightEdges
          )
        } else {
          cells.push(
            createCell(
              [mi, si],
              answerX,
              subStartY,
              answerWidth,
              subHeight,
              paper,
              `${major.label}-${sub.label}`,
              sub.points,
              sub.textElements,
              sub.modelAnswer,
              "answer",
              0,
              computeManuscriptGrid(sub, answerX, subStartY, answerWidth),
              sub.omrConfig
            )
          )
        }

        // vertical-sub行の右端は常にcontentRight
        rowRightEdges.push({
          yTop: subStartY,
          yBottom: subStartY + subHeight,
          rightX: contentRight,
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

    if (mi < majorQuestions.length - 1) {
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
  addSteppedBorderLines(
    lines,
    contentLeft,
    contentTop,
    contentRight,
    contentBottom,
    settings.borderConfig.outerBorder,
    settings.borderConfig,
    rowRightEdges
  )

  // vertical-sub 行のY範囲を収集（小問番号列セグメント化用）
  // branchVerticalRanges: vertical-branch行のY範囲（枝問番号列用）
  const verticalRanges: { top: number; bottom: number }[] = []
  const branchVerticalRanges: { top: number; bottom: number }[] = []
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
        trackY += gridTotalHeight(gridCells) * baseRowHeight
      } else {
        // 縦配置モード: 全体がvertical-sub
        const segStart = trackY
        for (const sub of mq.subQuestions) {
          // 枝問番号列のセグメント
          if (sub.branchQuestions.length > 0) {
            if (!isGridHorizontal(sub.branchQuestions)) {
              // 全て縦配置 → 連続した垂直セグメント
              branchVerticalRanges.push({
                top: trackY,
                bottom: trackY + computeSubHeight(sub, baseRowHeight),
              })
            }
            // 横配置の場合は枝問番号列は不要（個別セル内に番号を表示）
          }
          trackY += computeSubHeight(sub, baseRowHeight)
        }
        verticalRanges.push({ top: segStart, bottom: trackY })
      }
    }
  }

  // 大問番号列の縦線 → 全高（従来通り）
  const ncSw = getLineWidth("numberColumn", settings.borderConfig)
  lines.push({
    x1: majorNumX + majorNumWidth,
    y1: contentTop,
    x2: majorNumX + majorNumWidth,
    y2: contentBottom,
    style: settings.borderConfig.numberColumnDivider,
    lineType: "numberColumn",
    strokeWidth: ncSw,
    dragInfo: {
      axis: "vertical",
      target: { type: "columnWidth", column: "majorNumber" },
      currentValueMm: majorNumWidth,
      minMm: 5,
    },
  })

  // 小問番号列の縦線 → 縦配置のセグメントのみ
  for (const range of verticalRanges) {
    lines.push({
      x1: subNumX + subNumWidth,
      y1: range.top,
      x2: subNumX + subNumWidth,
      y2: range.bottom,
      style: settings.borderConfig.numberColumnDivider,
      lineType: "numberColumn",
      strokeWidth: ncSw,
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
    for (const range of branchVerticalRanges) {
      lines.push({
        x1: branchNumX + branchNumWidth,
        y1: range.top,
        x2: branchNumX + branchNumWidth,
        y2: range.bottom,
        style: settings.borderConfig.numberColumnDivider,
        lineType: "numberColumn",
        strokeWidth: ncSw,
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
 * ステップ外枠描画: partial行がある場合、右辺と下辺をL字型に凹ませる。
 * 全行がcontentRightまで到達している場合は通常の矩形外枠を描画。
 */
function addSteppedBorderLines(
  lines: ComputedLine[],
  contentLeft: number,
  contentTop: number,
  contentRight: number,
  contentBottom: number,
  style: LineStyle,
  borderConfig: BorderConfig,
  rowRightEdges: { yTop: number; yBottom: number; rightX: number }[]
) {
  const sw = getLineWidth("outer", borderConfig)

  // 全行がcontentRightに到達しているか確認
  const hasPartialRow = rowRightEdges.some(
    (r) => Math.abs(r.rightX - contentRight) > 0.01
  )

  if (!hasPartialRow) {
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

  // 上辺: 最初の行のrightXまで
  const topRightX = rowRightEdges[0].rightX
  lines.push({
    x1: contentLeft,
    y1: contentTop,
    x2: topRightX,
    y2: contentTop,
    style,
    lineType: "outer",
    strokeWidth: sw,
  })

  // 左辺: 常にフル高
  lines.push({
    x1: contentLeft,
    y1: contentTop,
    x2: contentLeft,
    y2: contentBottom,
    style,
    lineType: "outer",
    strokeWidth: sw,
  })

  // 右辺 + 下辺: ステップ描画
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

  // 下辺: contentBottom で curRightX → contentLeft
  lines.push({
    x1: contentLeft,
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

function computeMultiPageLayoutFromDefinition(
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
  const answerX = branchNumX + branchNumWidth
  const answerWidth = contentRight - answerX

  interface PageData {
    cells: ComputedCell[]
    lines: ComputedLine[]
    numberLabels: ComputedNumberLabel[]
    verticalRanges: { top: number; bottom: number }[]
    branchVerticalRanges: { top: number; bottom: number }[]
    rowRightEdges: { yTop: number; yBottom: number; rightX: number }[]
    contentBottomY: number
  }

  function newPageData(): PageData {
    return {
      cells: [],
      lines: [],
      numberLabels: [],
      verticalRanges: [],
      branchVerticalRanges: [],
      rowRightEdges: [],
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
      fontSize: settings.fonts.numberSize,
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

        page.numberLabels.push({
          text: sub.label,
          x: cellX,
          y: cellY,
          width: subNumWidth,
          height: cellHeight,
          fontSize: settings.fonts.numberSize,
          displayMode: "sub-horizontal",
        })

        if (hasBranches) {
          const cellBranchNumX = cellX + subNumWidth
          const cellBranchNumWidth = branchNumWidth
          const cellAnswerX = cellBranchNumX + cellBranchNumWidth
          const cellAnswerWidth = cellWidth - subNumWidth - cellBranchNumWidth
          const cellRight = cellX + cellWidth
          renderBranchQuestions(
            sub,
            mi,
            gc.itemIndex,
            major.label,
            cellY,
            pageIdx,
            cellX,
            subNumWidth,
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
              cellX + subNumWidth,
              cellY,
              cellWidth - subNumWidth,
              cellHeight,
              paper,
              `${major.label}-${sub.label}`,
              sub.points,
              sub.textElements,
              sub.modelAnswer,
              "answer",
              pageIdx,
              computeManuscriptGrid(
                sub,
                cellX + subNumWidth,
                cellY,
                cellWidth - subNumWidth
              ),
              sub.omrConfig
            )
          )
        }

        // 番号ラベル右側の区切り線
        page.lines.push({
          x1: cellX + subNumWidth,
          y1: cellY,
          x2: cellX + subNumWidth,
          y2: cellY + cellHeight,
          style: settings.borderConfig.numberColumnDivider,
          lineType: "numberColumn",
          strokeWidth: getLineWidth("numberColumn", settings.borderConfig),
        })
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

      localY = majorStartY + gridTotalHeight(gridCells) * baseRowHeight
    } else {
      // === 縦配置モード ===
      const vertSegStart = localY
      major.subQuestions.forEach((sub, si) => {
        const subStartY = localY
        const hasBranches = sub.branchQuestions.length > 0
        const subHeight = computeSubHeight(sub, baseRowHeight)

        page.numberLabels.push({
          text: sub.label,
          x: subNumX,
          y: subStartY,
          width: subNumWidth,
          height: subHeight,
          fontSize: settings.fonts.numberSize,
          displayMode: "sub",
        })

        if (hasBranches) {
          renderBranchQuestions(
            sub,
            mi,
            si,
            major.label,
            subStartY,
            pageIdx,
            subNumX,
            subNumWidth,
            branchNumX,
            branchNumWidth,
            answerX,
            answerWidth,
            contentRight,
            baseRowHeight,
            paper,
            settings,
            page.cells,
            page.lines,
            page.numberLabels,
            page.rowRightEdges
          )

          // 枝問番号列のセグメント
          if (!isGridHorizontal(sub.branchQuestions)) {
            page.branchVerticalRanges.push({
              top: subStartY,
              bottom: subStartY + subHeight,
            })
          }
        } else {
          page.cells.push(
            createCell(
              [mi, si],
              answerX,
              subStartY,
              answerWidth,
              subHeight,
              paper,
              `${major.label}-${sub.label}`,
              sub.points,
              sub.textElements,
              sub.modelAnswer,
              "answer",
              pageIdx,
              computeManuscriptGrid(sub, answerX, subStartY, answerWidth),
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

      page.verticalRanges.push({ top: vertSegStart, bottom: localY })
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
      if (spacingHeight > 0) {
        // 大問間スペーシングのrightX追跡
        const spacingTop = currentY
        currentY += spacingHeight
        pagesData[currentPageIdx].rowRightEdges.push({
          yTop: spacingTop,
          yBottom: currentY,
          rightX: contentRight,
        })
      }
    }

    currentY = layoutMajorOnPage(
      pagesData[currentPageIdx],
      major,
      mi,
      currentY,
      currentPageIdx
    )

    if (mi < majorQuestions.length - 1) {
      pagesData[currentPageIdx].lines.push({
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
    addSteppedBorderLines(
      pd.lines,
      contentLeft,
      contentTop,
      contentRight,
      pageContentBottom,
      settings.borderConfig.outerBorder,
      settings.borderConfig,
      pd.rowRightEdges
    )

    // 番号列の縦線
    const ncSwPage = getLineWidth("numberColumn", settings.borderConfig)

    // 大問番号列の縦線
    pd.lines.push({
      x1: majorNumX + majorNumWidth,
      y1: contentTop,
      x2: majorNumX + majorNumWidth,
      y2: pageContentBottom,
      style: settings.borderConfig.numberColumnDivider,
      lineType: "numberColumn",
      strokeWidth: ncSwPage,
    })

    // 小問番号列の縦線（縦配置セグメントのみ）
    for (const range of pd.verticalRanges) {
      pd.lines.push({
        x1: subNumX + subNumWidth,
        y1: range.top,
        x2: subNumX + subNumWidth,
        y2: range.bottom,
        style: settings.borderConfig.numberColumnDivider,
        lineType: "numberColumn",
        strokeWidth: ncSwPage,
      })
    }

    // 枝問番号列の縦線（vertical-branchセグメントのみ）
    if (hasBranch) {
      for (const range of pd.branchVerticalRanges) {
        pd.lines.push({
          x1: branchNumX + branchNumWidth,
          y1: range.top,
          x2: branchNumX + branchNumWidth,
          y2: range.bottom,
          style: settings.borderConfig.numberColumnDivider,
          lineType: "numberColumn",
          strokeWidth: ncSwPage,
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
