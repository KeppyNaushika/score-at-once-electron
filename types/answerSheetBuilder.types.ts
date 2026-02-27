/**
 * 解答用紙作成機能（Answer Sheet Builder）の型定義
 *
 * 3階層の問題構造（大問 > 小問 > 枝問）に対応した
 * 解答用紙のレイアウト定義・計算結果・エクスポート設定。
 */

// =====================
// 基本型
// =====================

export type PaperSize = "A4" | "B4" | "A3" | "B5"
export type Orientation = "portrait" | "landscape"
export type LineStyle = "solid" | "dashed" | "dotted"
export type MajorNumberDisplayMode = "multirow" | "boxed-top"
export type SubQuestionLayout = "vertical" | "horizontal"
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
}

export interface MajorQuestion {
  id: string
  label: string
  numberDisplayMode: MajorNumberDisplayMode
  subQuestions: SubQuestion[]
  spacingBefore: boolean
  subQuestionLayout: SubQuestionLayout
  /** 横配置時の行ごとの列数 (例: [3, 4, 2]) */
  horizontalColumnsPerRow?: number[]
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
}

// =====================
// 解答用紙定義（トップレベル）
// =====================

export interface AnswerSheetDefinition {
  id: string
  name: string
  settings: GlobalSettings
  majorQuestions: MajorQuestion[]
  renderMode: RenderMode
  createdAt?: string
  updatedAt?: string
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
  displayMode: MajorNumberDisplayMode | "sub" | "sub-horizontal" | "branch"
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
      type: "DELETE_BRANCH_QUESTION"
      payload: { majorIndex: number; subIndex: number; branchIndex: number }
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
