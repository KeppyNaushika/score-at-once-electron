/**
 * 解答用紙作成機能（Answer Sheet Builder）の型定義
 *
 * 3階層の問題構造（大問 > 小問 > 枝問）に対応した
 * 解答用紙のレイアウト定義・計算結果・エクスポート設定。
 */

import type {
  ComputedOMRBubble,
  ComputedOMRDigitBox,
  OMRCellConfig,
} from "./omr.types"

// =====================
// 基本型
// =====================

export type PaperSize = "A4" | "B4" | "A3" | "B5"
export type Orientation = "portrait" | "landscape"
export type LineStyle = "solid" | "dashed" | "dotted"
export type MajorNumberDisplayMode = "multirow" | "boxed-top"
export type RenderMode = "answer-sheet" | "model-answer"
export type HorizontalAlign = "left" | "center" | "right"
export type VerticalAlign = "top" | "middle" | "bottom"

// =====================
// セル内テキスト要素
// =====================

export interface CellTextElement {
  id: string
  text: string
  fontSize: number
  fontWeight: "normal" | "bold"
  fontStyle?: "normal" | "italic"
  textDecoration?: "none" | "line-through"
  horizontalAlign: HorizontalAlign
  verticalAlign: VerticalAlign
  isMathJax?: boolean
}

// =====================
// 罫線設定
// =====================

export interface BorderStyles {
  top?: LineStyle
  bottom?: LineStyle
  left?: LineStyle
  right?: LineStyle
}

// =====================
// 原稿用紙設定
// =====================

export interface ManuscriptPaperConfig {
  enabled: boolean
  columns: number
  rows: number
  cellSizeMm: number
}

// =====================
// 3階層問題構造
// =====================

export interface BranchQuestion {
  id: string
  label: string
  heightMultiplier: number
  points: number
  textElements: CellTextElement[]
  modelAnswer?: string
  borderStyles?: BorderStyles
  /** 横配置時の列スパン（デフォルト1） */
  colSpan?: number
  /** OMR自動認識設定 */
  omrConfig?: OMRCellConfig
}

export interface SubQuestion {
  id: string
  label: string
  branchQuestions: BranchQuestion[]
  heightMultiplier: number
  points: number
  textElements: CellTextElement[]
  manuscriptPaper?: ManuscriptPaperConfig
  modelAnswer?: string
  borderStyles?: BorderStyles
  /** 横配置時の列スパン（デフォルト1） */
  colSpan?: number
  /** 枝問横配置の行ごとの列数 (例: [3, 2])。空/未定義なら全て縦配置 */
  branchHorizontalColumnsPerRow?: number[]
  /** 枝問ごとに配点するか（undefined/true=枝問配点、false=完答） */
  usesBranchPoints?: boolean
  /** OMR自動認識設定 */
  omrConfig?: OMRCellConfig
}

export interface MajorQuestion {
  id: string
  label: string
  subQuestions: SubQuestion[]
  /** 横配置時の行ごとの列数 (例: [3, 4, 2])。空/未定義なら全て縦配置 */
  horizontalColumnsPerRow?: number[]
}

// =====================
// レイアウト行（buildLayoutRows用）
// =====================

export type LayoutRow =
  | {
      type: "horizontal"
      subs: {
        sub: SubQuestion
        subIndex: number
        colStart: number
        span: number
      }[]
      columns: number
    }
  | {
      type: "vertical-sub"
      sub: SubQuestion
      subIndex: number
    }

// =====================
// 枝問レイアウト行（buildBranchLayoutRows用）
// =====================

export type BranchLayoutRow =
  | {
      type: "horizontal"
      branches: {
        branch: BranchQuestion
        branchIndex: number
        colStart: number
        span: number
      }[]
      columns: number
    }
  | {
      type: "vertical-branch"
      branch: BranchQuestion
      branchIndex: number
    }

// =====================
// マージン設定
// =====================

export interface Margins {
  top: number
  bottom: number
  left: number
  right: number
}

// =====================
// 列幅設定
// =====================

export interface ColumnWidths {
  majorNumber: number
  subNumber: number
  branchNumber: number
}

// =====================
// スペーシング設定
// =====================

export interface SpacingConfig {
  majorQuestionSpacing: number
  headerHeight: number
}

// =====================
// 罫線グローバル設定
// =====================

export interface BorderConfig {
  outerBorder: LineStyle
  majorDivider: LineStyle
  subDivider: LineStyle
  branchDivider: LineStyle
  numberColumnDivider: LineStyle
  outerBorderWidth?: number
  majorDividerWidth?: number
  subDividerWidth?: number
  branchDividerWidth?: number
  numberColumnDividerWidth?: number
}

// =====================
// OMRマーカー設定
// =====================

export interface OMRMarkerConfig {
  enabled: boolean
  sizeMm: number
  offsetMm: number
}

// =====================
// フォント設定
// =====================

export interface FontConfig {
  family: string
  defaultSize: number
  numberSize: number
}

// =====================
// グローバル設定
// =====================

export interface GlobalSettings {
  paperSize: PaperSize
  orientation: Orientation
  margins: Margins
  baseRowHeight: number
  columnWidths: ColumnWidths
  spacing: SpacingConfig
  borderConfig: BorderConfig
  omrMarkers: OMRMarkerConfig
  fonts: FontConfig
  numberDisplayMode: MajorNumberDisplayMode
}

// =====================
// 解答用紙定義（トップレベル）
// =====================

export interface LabelPresets {
  major?: string
  sub?: string
  branch?: string
}

export interface AnswerSheetDefinition {
  id: string
  name: string
  settings: GlobalSettings
  majorQuestions: MajorQuestion[]
  renderMode: RenderMode
  labelPresets?: LabelPresets
  createdAt?: string
  updatedAt?: string
}

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
  /** 模範解答 */
  modelAnswer?: string
  /** セル種類 */
  cellType: "answer" | "major-number" | "sub-number" | "branch-number"
  /** このセルが属するページ (0-indexed) */
  pageIndex: number
  /** 原稿用紙グリッド情報 */
  manuscriptGrid?: ManuscriptGrid
  /** OMRバブル位置（choiceセル用） */
  omrBubbles?: ComputedOMRBubble[]
  /** OMR数字欄位置（handwritten-digitセル用） */
  omrDigitBoxes?: ComputedOMRDigitBox[]
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
  style: LineStyle
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

export interface ComputedLayout {
  pageWidthMm: number
  pageHeightMm: number
  cells: ComputedCell[]
  lines: ComputedLine[]
  numberLabels: ComputedNumberLabel[]
  omrMarkerPositions: ComputedOMRMarker[]
  /** ページ溢れ時にtrueになる */
  overflow: boolean
  /** 使用した高さ（mm） */
  contentHeightMm: number
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
  contentHeightMm: number
}

export interface ComputedMultiPageLayout {
  pages: ComputedPageLayout[]
  totalPages: number
  pageWidthMm: number
  pageHeightMm: number
}

// =====================
// useReducer アクション型
// =====================

export type AnswerSheetAction =
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_DEFINITION"; payload: AnswerSheetDefinition }
  | { type: "UPDATE_SETTINGS"; payload: Partial<GlobalSettings> }
  | { type: "SET_NAME"; payload: string }
  | { type: "SET_RENDER_MODE"; payload: RenderMode }
  | { type: "ADD_MAJOR_QUESTION" }
  | {
      type: "UPDATE_MAJOR_QUESTION"
      payload: { index: number; data: Partial<MajorQuestion> }
    }
  | { type: "DELETE_MAJOR_QUESTION"; payload: { index: number } }
  | {
      type: "REORDER_MAJOR_QUESTIONS"
      payload: { fromIndex: number; toIndex: number }
    }
  | { type: "ADD_SUB_QUESTION"; payload: { majorIndex: number } }
  | {
      type: "UPDATE_SUB_QUESTION"
      payload: {
        majorIndex: number
        subIndex: number
        data: Partial<SubQuestion>
      }
    }
  | {
      type: "DELETE_SUB_QUESTION"
      payload: { majorIndex: number; subIndex: number }
    }
  | {
      type: "ADD_BRANCH_QUESTION"
      payload: { majorIndex: number; subIndex: number }
    }
  | {
      type: "UPDATE_BRANCH_QUESTION"
      payload: {
        majorIndex: number
        subIndex: number
        branchIndex: number
        data: Partial<BranchQuestion>
      }
    }
  | {
      type: "REORDER_SUB_QUESTIONS"
      payload: { majorIndex: number; fromIndex: number; toIndex: number }
    }
  | {
      type: "REORDER_BRANCH_QUESTIONS"
      payload: {
        majorIndex: number
        subIndex: number
        fromIndex: number
        toIndex: number
      }
    }
  | {
      type: "DELETE_BRANCH_QUESTION"
      payload: { majorIndex: number; subIndex: number; branchIndex: number }
    }
  | {
      type: "SET_LABEL_PRESET"
      payload: { category: "major" | "sub" | "branch"; preset: string }
    }

// =====================
// IPC関連型
// =====================

export interface ASBExportPdfArgs {
  definition: AnswerSheetDefinition
  outputPath: string
  svgString?: string
}

export interface ASBExportPngArgs {
  definition: AnswerSheetDefinition
  outputPath: string
  dpi: number
  svgString?: string
}

export interface ASBConvertToProjectArgs {
  definition: AnswerSheetDefinition
  userId: string
  svgString?: string
}

export interface ASBPrintArgs {
  definition: AnswerSheetDefinition
}

export interface ASBExportResult {
  success: boolean
  filePath?: string
  error?: string
}

export interface ASBConvertResult {
  success: boolean
  projectId?: string
  error?: string
}

export interface ASBDefinitionListItem {
  id: string
  name: string
  updatedAt?: string
}
