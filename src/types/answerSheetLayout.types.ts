/**
 * 解答用紙レイアウト計算結果の型定義
 *
 * computeLayoutFromDefinition / computeMultiPageLayoutFromDefinition が出力する
 * セル・罫線・ラベル・OMRマーカーの座標情報を定義する。
 */

import type {
  BorderLineStyle,
  BranchQuestion,
  CellImageElement,
  CellTextElement,
  MajorNumberDisplayMode,
  ManuscriptCharGuide,
  ManuscriptGuidePosition,
  SubQuestion,
} from "./answerSheetDefinition.types"
import type { ComputedOMRBubble } from "./omr.types"

// =====================
// グリッドセル（buildGridLayout用）
// =====================

export interface GridCell<T> {
  item: T
  itemIndex: number
  x: number // 0〜1 の相対X座標
  y: number // baseRowHeight 単位のY座標
  width: number // 0〜1 の相対幅
  height: number // baseRowHeight 単位の高さ
}

export type SubGridCell = GridCell<SubQuestion>
export type BranchGridCell = GridCell<BranchQuestion>

// =====================
// 原稿用紙グリッド（レイアウト計算結果）
// =====================

export interface ManuscriptGrid {
  columns: number
  rows: number
  cellSizeMm: number
  /** グリッド開始X座標（mm） */
  gridX: number
  /** グリッド開始Y座標（mm） */
  gridY: number
  /** = columns * cellSizeMm */
  gridWidth: number
  /** = rows * cellSizeMm */
  gridHeight: number
  /** 縦書き（縦組み・右→左）か。false = 横書き */
  vertical: boolean
  /** 文字を区切る罫線（行方向＝字間）の線種 */
  charDividerStyle: BorderLineStyle
  /** 文字を区切る罫線の太さ（mm） */
  charDividerWidth: number
  /** 行を区切る罫線（行間）の線種 */
  lineDividerStyle: BorderLineStyle
  /** 行を区切る罫線の太さ（mm） */
  lineDividerWidth: number
  /** 文字数ガイド（先頭からN文字目のマスに表示） */
  charGuides: ManuscriptCharGuide[]
  /** ガイド文字サイズ（mm） */
  guideFontSize: number
  /** ガイド表示位置（マスの隅） */
  guidePosition: ManuscriptGuidePosition
  /** ガイドの隅からの余白（mm） */
  guidePadding: number
}

// =====================
// レイアウト計算結果
// =====================

export interface ComputedCell {
  /** 問題パス: [majorIndex, subIndex, branchIndex?] */
  questionPath: number[]
  /** mm座標 */
  x: number
  y: number
  width: number
  height: number
  /** 0-1正規化座標（CropRegion用） */
  normalizedX: number
  normalizedY: number
  normalizedW: number
  normalizedH: number
  /** 表示ラベル */
  label: string
  /** 配点 */
  points: number
  /** テキスト要素 */
  textElements: CellTextElement[]
  /** 画像要素 */
  imageElements?: CellImageElement[]
  /** セル種類 */
  cellType: "answer" | "major-number" | "sub-number" | "branch-number"
  /** このセルが属するページ (0-indexed) */
  pageIndex: number
  /** 原稿用紙グリッド情報 */
  manuscriptGrid?: ManuscriptGrid
  /** OMRバブル位置（choiceセル用） */
  omrBubbles?: ComputedOMRBubble[]
}

export interface DragInfo {
  axis: "horizontal" | "vertical"
  target:
    | {
        type: "heightMultiplier"
        majorIndex: number
        subIndex: number
        branchIndex?: number
      }
    | {
        type: "columnWidth"
        column: "majorNumber" | "subNumber" | "branchNumber"
      }
  currentValueMm: number
  minMm: number
}

export interface ComputedLine {
  x1: number
  y1: number
  x2: number
  y2: number
  style: BorderLineStyle
  /** 線幅 (mm) */
  strokeWidth?: number
  /** 線種: outer / major / sub / branch / numberColumn / subHorizontalDivider */
  lineType: string
  /** ドラッグ操作情報（インタラクティブモード用） */
  dragInfo?: DragInfo
}

export interface ComputedNumberLabel {
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  displayMode:
    | MajorNumberDisplayMode
    | "sub"
    | "sub-horizontal"
    | "branch"
    | "branch-horizontal"
}

export interface ComputedOMRMarker {
  x: number
  y: number
  size: number
}

export interface ComputedHeaderField {
  fieldId: string
  type: "field" | "hfill" | "label"
  label: string
  x: number
  y: number
  width: number
  height: number
  gridCount: number
  lineStyle: BorderLineStyle
  lineWidth: number
  gridCellWidthMm?: number
  /** label タイプのフォントサイズ (mm) */
  fontSize?: number
  /** 試験変換時に対応するCropRegionを自動生成する */
  linkedRegionType?:
    "TOTAL_SCORE" | "SUBTOTAL_SCORE" | "STUDENT_NAME" | "STUDENT_ID"
}

export interface ComputedLayout {
  pageWidthMm: number
  pageHeightMm: number
  cells: ComputedCell[]
  lines: ComputedLine[]
  numberLabels: ComputedNumberLabel[]
  omrMarkerPositions: ComputedOMRMarker[]
  headerFields: ComputedHeaderField[]
  /** ページ溢れ時にtrueになる */
  overflow: boolean
  /** 使用した高さ（mm） */
  contentHeightMm: number
  /** 縦書き（縦組み・右→左）レイアウトか。レンダラのテキスト描画方向に使う */
  vertical?: boolean
}

// =====================
// 複数ページレイアウト
// =====================

export interface ComputedPageLayout {
  pageIndex: number
  cells: ComputedCell[]
  lines: ComputedLine[]
  numberLabels: ComputedNumberLabel[]
  omrMarkerPositions: ComputedOMRMarker[]
  headerFields: ComputedHeaderField[]
  contentHeightMm: number
  /** 縦書き（縦組み・右→左）レイアウトか */
  vertical?: boolean
}

export interface ComputedMultiPageLayout {
  pages: ComputedPageLayout[]
  totalPages: number
  pageWidthMm: number
  pageHeightMm: number
}
