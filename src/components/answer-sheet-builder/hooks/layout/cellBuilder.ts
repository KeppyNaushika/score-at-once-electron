/**
 * セル生成ヘルパー
 *
 * ComputedCell の生成・原稿用紙グリッド計算・OMRバブル/数字欄の座標計算を行う。
 */

import type {
  BorderConfig,
  BranchQuestion,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"
import type {
  ComputedCell,
  ManuscriptGrid,
} from "@/types/answerSheetLayout.types"
import type { ComputedOMRBubble, OMRCellConfig } from "@/types/omr.types"

import {
  DEFAULT_MANUSCRIPT_CHAR_DIVIDER,
  DEFAULT_MANUSCRIPT_DIVIDER_WIDTH,
  DEFAULT_MANUSCRIPT_GUIDE_FONT_RATIO,
  DEFAULT_MANUSCRIPT_GUIDE_PADDING_RATIO,
  DEFAULT_MANUSCRIPT_GUIDE_POSITION,
  DEFAULT_MANUSCRIPT_LINE_DIVIDER,
} from "../../constants"
import {
  buildBranchGridLayout,
  buildSubGridLayout,
  gridTotalHeight,
  isGridHorizontal,
} from "./gridBuilder"
import { availableBranchAreaWidth } from "./manuscriptWidth"

/**
 * 小問の高さを計算する（baseRowHeight単位のmm値）
 *
 * 枝問の行の折り返しは幅で決まるので、高さを出すにも枝問領域の幅が要る。
 * 受け取る小問は**幅を書き換える前**のもの（`buildSubGridLayout` が返す `item` と同じ）。
 */
export function computeSubHeight(
  sub: SubQuestion,
  baseRowHeight: number,
  horizontalAreaWidth: number,
  subNumberWidth: number,
  branchNumberWidth: number
): number {
  if (sub.branchQuestions.length > 0) {
    const branchCells = buildBranchGridLayout(
      sub.branchQuestions,
      baseRowHeight,
      branchNumberWidth,
      availableBranchAreaWidth(sub, horizontalAreaWidth, subNumberWidth)
    )
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
        isCorrectAnswer: config.correctAnswers.includes(i),
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
        isCorrectAnswer: config.correctAnswers.includes(i),
      })
    }
  }

  return bubbles
}

/**
 * セルを作成しOMRバブルがあれば計算する
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
  }

  return cell
}

/**
 * 原稿用紙グリッドの座標を計算する。
 *
 * 受けるのは小問でも枝問でもよい（原稿用紙はセルの持ち物で、どちらにも付く）。
 */
export function computeManuscriptGrid(
  cell: SubQuestion | BranchQuestion,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  borderConfig?: BorderConfig
): ManuscriptGrid | undefined {
  const manuscriptPaper = cell.manuscriptPaper
  if (!manuscriptPaper?.enabled) return undefined
  const { columns, rows } = manuscriptPaper
  // 0以下はゼロ除算・剰余0でNaNになるため描画しない（防御）
  if (columns < 1 || rows < 1) return undefined
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
    // 論理（横組み）座標で計算。縦組みは verticalTransform で後段変換する。
    vertical: false,
    // 罫線スタイルはグローバル設定（罫線タブ）から解決。行方向（字間）は破線が既定。
    charDividerStyle:
      borderConfig?.manuscriptCharDivider ?? DEFAULT_MANUSCRIPT_CHAR_DIVIDER,
    charDividerWidth:
      borderConfig?.manuscriptCharDividerWidth ??
      DEFAULT_MANUSCRIPT_DIVIDER_WIDTH,
    lineDividerStyle:
      borderConfig?.manuscriptLineDivider ?? DEFAULT_MANUSCRIPT_LINE_DIVIDER,
    lineDividerWidth:
      borderConfig?.manuscriptLineDividerWidth ??
      DEFAULT_MANUSCRIPT_DIVIDER_WIDTH,
    // 文字位置マーカーは原稿用紙ごとの設定。
    charGuides: manuscriptPaper.charGuides,
    // guideFontSize/guidePadding はマス比（1マス=1）で保存。cellSizeMm 倍して絶対mmへ。
    guideFontSize:
      (manuscriptPaper.guideFontSize ?? DEFAULT_MANUSCRIPT_GUIDE_FONT_RATIO) *
      cellSizeMm,
    guidePosition:
      manuscriptPaper.guidePosition ?? DEFAULT_MANUSCRIPT_GUIDE_POSITION,
    guidePadding:
      (manuscriptPaper.guidePadding ?? DEFAULT_MANUSCRIPT_GUIDE_PADDING_RATIO) *
      cellSizeMm,
  }
}

/** 大問の高さを計算する（mm値） */
export function computeMajorHeight(
  major: { subQuestions: SubQuestion[] },
  baseRowHeight: number,
  horizontalAreaWidth: number,
  subNumberWidth: number,
  branchNumberWidth: number
): number {
  if (isGridHorizontal(major.subQuestions)) {
    // 原稿用紙セルの layoutWidth はグリッドの中で必要幅に合う（レンダリングと同じ計算）
    const gridCells = buildSubGridLayout(
      major.subQuestions,
      baseRowHeight,
      horizontalAreaWidth,
      subNumberWidth,
      branchNumberWidth
    )
    return gridTotalHeight(gridCells) * baseRowHeight
  }
  return major.subQuestions.reduce(
    (sum, sub) =>
      sum +
      computeSubHeight(
        sub,
        baseRowHeight,
        horizontalAreaWidth,
        subNumberWidth,
        branchNumberWidth
      ),
    0
  )
}
