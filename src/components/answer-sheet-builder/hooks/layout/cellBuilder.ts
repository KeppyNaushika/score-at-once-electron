/**
 * セル生成ヘルパー
 *
 * ComputedCell の生成・原稿用紙グリッド計算・OMRバブル/数字欄の座標計算を行う。
 */

import type { SubQuestion } from "@/types/answerSheetDefinition.types"
import type {
  ComputedCell,
  ManuscriptGrid,
} from "@/types/answerSheetLayout.types"
import type {
  ComputedOMRBubble,
  ComputedOMRDigitBox,
  OMRCellConfig,
} from "@/types/omr.types"

import {
  buildBranchGridLayout,
  buildSubGridLayout,
  gridTotalHeight,
  isGridHorizontal,
} from "./gridBuilder"

/** 小問の高さを計算する（baseRowHeight単位のmm値） */
export function computeSubHeight(
  sub: SubQuestion,
  baseRowHeight: number
): number {
  if (sub.branchQuestions.length > 0) {
    const branchCells = buildBranchGridLayout(sub.branchQuestions)
    return gridTotalHeight(branchCells) * baseRowHeight
  }
  if (sub.manuscriptPaper?.enabled) {
    return sub.heightMultiplier * baseRowHeight * sub.manuscriptPaper.rows
  }
  return sub.heightMultiplier * baseRowHeight
}

/**
 * OMR choiceセルのバブル位置を計算（0-1正規化座標）
 *
 * 共通テスト準拠の横長楕円（角丸長方形）形状。
 * ラベルは楕円内部に配置される。
 */
export function computeOMRBubbles(
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

  // 共通テスト準拠: 縦長楕円のサイズ計算
  // 幅はセル幅ベースで計算、高さは幅の1.6倍（縦長楕円）
  const bubbleWidthMm = Math.max(2.5, Math.min(cellHeight * 0.35, 4))
  const bubbleHeightMm = Math.max(4, bubbleWidthMm * 1.6)

  if (config.layout === "horizontal") {
    const spacing = cellWidth / (n + 1)
    const cy = cellY + cellHeight / 2

    for (let i = 0; i < n; i++) {
      const cx = cellX + spacing * (i + 1)
      bubbles.push({
        normalizedCx: cx / paperWidth,
        normalizedCy: cy / paperHeight,
        normalizedWidth: bubbleWidthMm / paperWidth,
        normalizedHeight: bubbleHeightMm / paperHeight,
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
        normalizedWidth: bubbleWidthMm / paperWidth,
        normalizedHeight: bubbleHeightMm / paperHeight,
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
export function computeOMRDigitBoxes(
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
export function createCell(
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
  omrConfig?: OMRCellConfig,
  imageElements?: ComputedCell["imageElements"]
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
    imageElements,
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

/** 原稿用紙グリッドの座標を計算する */
export function computeManuscriptGrid(
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

/** 大問の高さを計算する（mm値） */
export function computeMajorHeight(
  major: { subQuestions: SubQuestion[] },
  baseRowHeight: number,
  horizontalAreaWidth?: number,
  subNumWidth?: number
): number {
  if (isGridHorizontal(major.subQuestions)) {
    // 原稿用紙セルの layoutWidth を必要幅に合わせる（レンダリングと同じ計算）
    const subs =
      horizontalAreaWidth != null && subNumWidth != null
        ? major.subQuestions.map((sub) => {
            if (
              sub.manuscriptPaper?.enabled &&
              sub.branchQuestions.length === 0
            ) {
              const snw = sub.label === "" ? 0 : subNumWidth
              const reqW =
                baseRowHeight *
                  sub.heightMultiplier *
                  sub.manuscriptPaper.columns +
                snw
              return { ...sub, layoutWidth: String(reqW / horizontalAreaWidth) }
            }
            return sub
          })
        : major.subQuestions
    const gridCells = buildSubGridLayout(subs)
    return gridTotalHeight(gridCells) * baseRowHeight
  }
  return major.subQuestions.reduce(
    (sum, sub) => sum + computeSubHeight(sub, baseRowHeight),
    0
  )
}
