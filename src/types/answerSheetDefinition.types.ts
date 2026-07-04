/**
 * 解答用紙定義の型定義
 *
 * 用紙設定・3階層問題構造（大問 > 小問 > 枝問）・
 * グローバル設定・useReducerアクション型を定義する。
 */

import type { OMRCellConfig } from "./omr.types"

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
  horizontalAlign: HorizontalAlign
  verticalAlign: VerticalAlign
}

// =====================
// セル内画像要素
// =====================

export type ImageObjectFit = "contain" | "cover" | "fill"
export type ImageVisibility = "both" | "answer-sheet-only" | "model-answer-only"

export interface CellImageElement {
  id: string
  imagePath: string // data/ からの相対パス
  originalName: string // 表示用ファイル名
  objectFit: ImageObjectFit
  horizontalAlign: HorizontalAlign
  verticalAlign: VerticalAlign
  opacity: number // 0-1
  /** 表示モード制限。未指定 = "both"（常に表示） */
  visibility?: ImageVisibility
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

/** 文字数ガイドを表示するマスの隅 */
export type ManuscriptGuidePosition =
  "top-left" | "top-right" | "bottom-left" | "bottom-right"

/**
 * 原稿用紙の文字位置マーカー（先頭からN文字目に紐づく目印）。
 * 数字ガイド（label）と区切り罫線（boundary）を1エントリに統合する。
 * - label が空文字列なら数字は表示しない（区切り罫線のみ使う場合）。
 * - boundary が未指定なら区切り罫線は引かない（数字ガイドのみ使う場合）。
 */
export interface ManuscriptCharGuide {
  /** 安定ID（React key・DB AsbCharGuide.id・アーカイブID再マッピングに使用） */
  id: string
  /** 先頭からの文字数（1始まり） */
  atChar: number
  /** 表示テキスト（空文字列 = 数字非表示） */
  label: string
  /** 区切り罫線の線種。未指定 = 罫線なし。N文字目の「次」の境界を置き換える */
  boundary?: LineStyle
  /** 区切り罫線の太さ（mm）。未指定 = 既定 */
  boundaryWidth?: number
  /** 破線のダッシュ長（線幅に対する倍率）。未指定 = 既定 */
  boundaryDashRatio?: number
  /** 破線/点線の間隔（線幅に対する倍率）。未指定 = 既定 */
  boundaryGapRatio?: number
}

export interface ManuscriptPaperConfig {
  enabled: boolean
  columns: number
  rows: number
  /** 文字位置マーカー（数字ガイド＋区切り罫線の統合リスト） */
  charGuides?: ManuscriptCharGuide[]
  /** ガイド文字サイズ（1マス＝1とした相対値。マス比）。未指定 = 既定 */
  guideFontSize?: number
  /** ガイド表示位置（マスの隅）。未指定 = "bottom-left" */
  guidePosition?: ManuscriptGuidePosition
  /** ガイドの隅からの余白（1マス＝1とした相対値。マス比）。未指定 = 既定 */
  guidePadding?: number
}

// =====================
// 3階層問題構造
// =====================

export type NextPlacement = "inline" | "break"

export interface BranchQuestion {
  id: string
  label: string
  heightMultiplier: number
  points: number
  textElements: CellTextElement[]
  imageElements?: CellImageElement[]
  borderStyles?: BorderStyles
  /** 幅の分数表記 (例: "1/4", "1/3", "1/2")。未指定 = 全幅（縦配置） */
  layoutWidth?: string
  /** 次の要素の配置方法。デフォルト "inline" */
  nextPlacement?: NextPlacement
  /** この要素自身をN行上に戻して配置する。未指定 = 戻らない */
  goUp?: number
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
  imageElements?: CellImageElement[]
  manuscriptPaper?: ManuscriptPaperConfig
  borderStyles?: BorderStyles
  /** 幅の分数表記 (例: "1/4", "1/3", "1/2")。未指定 = 全幅（縦配置） */
  layoutWidth?: string
  /** 次の要素の配置方法。デフォルト "inline" */
  nextPlacement?: NextPlacement
  /** この要素自身をN行上に戻して配置する。未指定 = 戻らない */
  goUp?: number
  /** 枝問ごとに配点するか（undefined/true=枝問配点、false=完答） */
  usesBranchPoints?: boolean
  /** OMR自動認識設定 */
  omrConfig?: OMRCellConfig
}

export interface MajorQuestion {
  id: string
  label: string
  subQuestions: SubQuestion[]
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
  majorNumberDivider: LineStyle
  subNumberDivider: LineStyle
  branchNumberDivider: LineStyle
  outerBorderWidth?: number
  majorDividerWidth?: number
  subDividerWidth?: number
  branchDividerWidth?: number
  majorNumberDividerWidth?: number
  subNumberDividerWidth?: number
  branchNumberDividerWidth?: number
  /** 原稿用紙: 文字を区切る罫線（行方向＝字間）。既定 dashed */
  manuscriptCharDivider?: LineStyle
  /** 原稿用紙: 行を区切る罫線（行間）。既定 solid */
  manuscriptLineDivider?: LineStyle
  manuscriptCharDividerWidth?: number
  manuscriptLineDividerWidth?: number
  // 破線/点線のダッシュ長・間隔（いずれも線幅に対する倍率）。
  // 未指定時は既定（dash=3倍, gap=2倍）。罫線種別ごとに個別設定できる。
  outerBorderDashRatio?: number
  outerBorderGapRatio?: number
  majorDividerDashRatio?: number
  majorDividerGapRatio?: number
  subDividerDashRatio?: number
  subDividerGapRatio?: number
  branchDividerDashRatio?: number
  branchDividerGapRatio?: number
  majorNumberDividerDashRatio?: number
  majorNumberDividerGapRatio?: number
  subNumberDividerDashRatio?: number
  subNumberDividerGapRatio?: number
  branchNumberDividerDashRatio?: number
  branchNumberDividerGapRatio?: number
  manuscriptCharDividerDashRatio?: number
  manuscriptCharDividerGapRatio?: number
  manuscriptLineDividerDashRatio?: number
  manuscriptLineDividerGapRatio?: number
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
  majorNumberSize: number
  subNumberSize: number
  branchNumberSize: number
}

// =====================
// 段組み設定
// =====================

export interface MultiColumnConfig {
  enabled: boolean
  columnCount: 2 | 3
  columnGapMm: number
  dividerLine: LineStyle | null
  dividerLineWidth: number
}

// =====================
// ヘッダーフィールド定義
// =====================

export type HeaderFieldType = "field" | "hfill" | "label"

export type LinkedRegionType =
  "TOTAL_SCORE" | "SUBTOTAL_SCORE" | "STUDENT_NAME" | "STUDENT_ID"

export interface HeaderFieldDefinition {
  id: string
  type: HeaderFieldType
  label: string
  widthMm: number
  heightMm: number
  gridCount: number
  lineStyle: LineStyle
  lineWidth: number
  order: number
  /** label タイプのフォントサイズ (mm) */
  fontSize?: number
  /** 試験変換時に対応するCropRegionを自動生成する */
  linkedRegionType?: LinkedRegionType
}

// =====================
// グローバル設定
// =====================

export interface GlobalSettings {
  paperSize: PaperSize
  orientation: Orientation
  /** 用紙全体を縦組み（右→左）にする。未指定 = false（横組み・左→右） */
  verticalLayout?: boolean
  margins: Margins
  baseRowHeight: number
  columnWidths: ColumnWidths
  spacing: SpacingConfig
  borderConfig: BorderConfig
  omrMarkers: OMRMarkerConfig
  fonts: FontConfig
  numberDisplayMode: MajorNumberDisplayMode
  multiColumn: MultiColumnConfig
  headerFields: HeaderFieldDefinition[]
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
  | { type: "ADD_HEADER_FIELD"; payload?: Partial<HeaderFieldDefinition> }
  | {
      type: "UPDATE_HEADER_FIELD"
      payload: { fieldId: string; data: Partial<HeaderFieldDefinition> }
    }
  | { type: "DELETE_HEADER_FIELD"; payload: { fieldId: string } }
  | {
      type: "REORDER_HEADER_FIELDS"
      payload: { fromIndex: number; toIndex: number }
    }
