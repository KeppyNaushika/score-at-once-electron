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
export type BorderLineStyle = "solid" | "dashed" | "dotted"
export type MajorNumberDisplayMode = "multirow" | "boxed-top"
export type RenderMode = "answer-sheet" | "model-answer"
export type HorizontalAlign = "left" | "center" | "right"
export type VerticalAlign = "top" | "middle" | "bottom"

// =====================
// セル内テキスト要素
// =====================

/**
 * テキスト要素の属性（自身の列だけ。子は持たない）。
 *
 * 実体の型を「自身の属性」と「子」に割ってあるのは、**更新の指示に子が紛れ込まないため**。
 * `Partial<CellTextElement>` だと id まで書き換えられてしまう。
 */
export interface AsbTextElementAttributes {
  text: string
  fontSize: number
  horizontalAlign: HorizontalAlign
  verticalAlign: VerticalAlign
}

export interface CellTextElement extends AsbTextElementAttributes {
  id: string
}

// =====================
// セル内画像要素
// =====================

export type ImageObjectFit = "contain" | "cover" | "fill"
export type ImageVisibility = "both" | "answer-sheet-only" | "model-answer-only"

export interface AsbImageElementAttributes {
  imagePath: string // data/ からの相対パス
  originalName: string // 表示用ファイル名
  objectFit: ImageObjectFit
  horizontalAlign: HorizontalAlign
  verticalAlign: VerticalAlign
  opacity: number // 0-1
  /** 表示モード制限。未指定 = "both"（常に表示） */
  visibility?: ImageVisibility
}

export interface CellImageElement extends AsbImageElementAttributes {
  id: string
}

// =====================
// 罫線設定
// =====================

export interface BorderStyles {
  top?: BorderLineStyle
  bottom?: BorderLineStyle
  left?: BorderLineStyle
  right?: BorderLineStyle
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
export interface AsbCharGuideAttributes {
  /** 先頭からの文字数（1始まり） */
  atChar: number
  /** 表示テキスト（空文字列 = 数字非表示） */
  label: string
  /** 区切り罫線の線種。未指定 = 罫線なし。N文字目の「次」の境界を置き換える */
  boundary?: BorderLineStyle
  /** 区切り罫線の太さ（mm）。未指定 = 既定 */
  boundaryWidth?: number
  /** 破線のダッシュ長（線幅に対する倍率）。未指定 = 既定 */
  boundaryDashRatio?: number
  /** 破線/点線の間隔（線幅に対する倍率）。未指定 = 既定 */
  boundaryGapRatio?: number
}

export interface ManuscriptCharGuide extends AsbCharGuideAttributes {
  /** 安定ID（React key・DB AsbCharGuide.id・アーカイブID再マッピングに使用） */
  id: string
}

/** 原稿用紙の設定（文字位置マーカーは別テーブルなので含めない） */
export interface ManuscriptPaperAttributes {
  enabled: boolean
  columns: number
  rows: number
  /** ガイド文字サイズ（1マス＝1とした相対値。マス比）。未指定 = 既定 */
  guideFontSize?: number
  /** ガイド表示位置（マスの隅）。未指定 = "bottom-left" */
  guidePosition?: ManuscriptGuidePosition
  /** ガイドの隅からの余白（1マス＝1とした相対値。マス比）。未指定 = 既定 */
  guidePadding?: number
}

export interface ManuscriptPaperConfig extends ManuscriptPaperAttributes {
  /** 文字位置マーカー（数字ガイド＋区切り罫線の統合リスト） */
  charGuides?: ManuscriptCharGuide[]
}

// =====================
// 3階層問題構造
// =====================

export type NextPlacement = "inline" | "break"

export interface AsbBranchQuestionAttributes {
  label: string
  heightMultiplier: number
  points: number
  borderStyles?: BorderStyles
  /** 幅の分数表記 (例: "1/4", "1/3", "1/2")。未指定 = 全幅（縦配置） */
  layoutWidth?: string
  /** 次の要素の配置方法。デフォルト "inline" */
  nextPlacement?: NextPlacement
  /** この要素自身をN行上に戻して配置する。未指定 = 戻らない */
  goUp?: number
}

export interface BranchQuestion extends AsbBranchQuestionAttributes {
  id: string
  textElements: CellTextElement[]
  imageElements?: CellImageElement[]
  /** OMR自動認識設定 */
  omrConfig?: OMRCellConfig
}

export interface AsbSubQuestionAttributes {
  label: string
  heightMultiplier: number
  points: number
  borderStyles?: BorderStyles
  /** 幅の分数表記 (例: "1/4", "1/3", "1/2")。未指定 = 全幅（縦配置） */
  layoutWidth?: string
  /** 次の要素の配置方法。デフォルト "inline" */
  nextPlacement?: NextPlacement
  /** この要素自身をN行上に戻して配置する。未指定 = 戻らない */
  goUp?: number
  /** 枝問ごとに配点するか（undefined/true=枝問配点、false=完答） */
  usesBranchPoints?: boolean
  /** 原稿用紙。文字位置マーカーは別テーブル・別 action なので含めない */
  manuscriptPaper?: ManuscriptPaperAttributes
}

export interface SubQuestion extends AsbSubQuestionAttributes {
  id: string
  branchQuestions: BranchQuestion[]
  textElements: CellTextElement[]
  imageElements?: CellImageElement[]
  /** 木の中では文字位置マーカーまで持つ（属性だけの版を子ごと狭める） */
  manuscriptPaper?: ManuscriptPaperConfig
  /** OMR自動認識設定 */
  omrConfig?: OMRCellConfig
}

/**
 * 小問の更新の指示。
 *
 * 原稿用紙は「列数だけ」「ガイドの位置だけ」と一部を触るので、ここだけ入れ子の一部指定を
 * 許す。文字位置マーカーは別テーブル・別 action なので入ってこない。
 */
export type AsbSubQuestionUpdate = Partial<
  Omit<AsbSubQuestionAttributes, "manuscriptPaper">
> & {
  manuscriptPaper?: Partial<ManuscriptPaperAttributes>
}

export interface AsbMajorQuestionAttributes {
  label: string
}

export interface MajorQuestion extends AsbMajorQuestionAttributes {
  id: string
  subQuestions: SubQuestion[]
}

/**
 * セルの中身（テキスト・画像・OMR設定）が、どちらのセルに属するか。
 *
 * 小問と枝問はどちらも「解答を書くセル」として同じ子を持つが、DB では別の外部キーに
 * なる。親の指し方をこの1つの形にまとめて、子の書き込みが親の種類を意識せずに済むようにする。
 */
export type AsbCellParent =
  { subQuestionId: string } | { branchQuestionId: string }

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
  outerBorder: BorderLineStyle
  majorDivider: BorderLineStyle
  subDivider: BorderLineStyle
  branchDivider: BorderLineStyle
  majorNumberDivider: BorderLineStyle
  subNumberDivider: BorderLineStyle
  branchNumberDivider: BorderLineStyle
  outerBorderWidth?: number
  majorDividerWidth?: number
  subDividerWidth?: number
  branchDividerWidth?: number
  majorNumberDividerWidth?: number
  subNumberDividerWidth?: number
  branchNumberDividerWidth?: number
  /** 原稿用紙: 文字を区切る罫線（行方向＝字間）。既定 dashed */
  manuscriptCharDivider?: BorderLineStyle
  /** 原稿用紙: 行を区切る罫線（行間）。既定 solid */
  manuscriptLineDivider?: BorderLineStyle
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
  dividerLine: BorderLineStyle | null
  dividerLineWidth: number
}

// =====================
// ヘッダーフィールド定義
// =====================

export type HeaderFieldType = "field" | "hfill" | "label"

export type LinkedRegionType =
  "TOTAL_SCORE" | "SUBTOTAL_SCORE" | "STUDENT_NAME" | "STUDENT_ID"

export interface AsbHeaderFieldAttributes {
  type: HeaderFieldType
  label: string
  widthMm: number
  heightMm: number
  gridCount: number
  lineStyle: BorderLineStyle
  lineWidth: number
  /** label タイプのフォントサイズ (mm) */
  fontSize?: number
  /** 試験変換時に対応するCropRegionを自動生成する */
  linkedRegionType?: LinkedRegionType
}

export interface HeaderFieldDefinition extends AsbHeaderFieldAttributes {
  id: string
  /** 並びの位置。決めるのは並べ替えの操作で、属性ではない */
  order: number
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

/** ヘッダー項目（別テーブル）を除いた用紙設定 */
export type PaperSettings = Omit<GlobalSettings, "headerFields">

/** 解答用紙1件の属性（子は持たない）。用紙設定は DB では列として平らに並ぶ */
export interface AsbDefinitionAttributes {
  name: string
  renderMode: RenderMode
  labelPresets?: LabelPresets
  settings: PaperSettings
}

/**
 * 解答用紙1件の更新の指示。
 *
 * 用紙設定は項目数が多く、画面はいつも一部だけを触る（余白だけ・段組みだけ）ので、
 * ここだけ入れ子の一部指定を許す。ヘッダー項目は別テーブルなので入ってこない。
 */
export type AsbDefinitionUpdate = Partial<
  Omit<AsbDefinitionAttributes, "settings">
> & {
  settings?: Partial<PaperSettings>
}

export interface AnswerSheetDefinition extends AsbDefinitionAttributes {
  id: string
  settings: GlobalSettings
  majorQuestions: MajorQuestion[]
  createdAt?: string
  updatedAt?: string
}

// =====================
// useReducer アクション型
// =====================

/** 番号の既定を当てる対象 */
export type LabelCategory = "major" | "sub" | "branch"

/**
 * 編集の意図。
 *
 * **対象は id で指す。** 添字で指すと、その添字がプロセス境界を越えて「どの行を書くか」
 * の決定に使われる（過去に是正した密行列UIと同じ形）。並べ替えだけは新しい並びが
 * renderer にしか無いので、id の並び（`orderedIds`）を運ぶ。
 *
 * **新しい実体は呼び出し側が作って載せる。** reducer の中で作ると、その id を
 * 呼び出し側が知れず、対応する書き込みを組み立てられない。
 *
 * 更新の指示（`data`）が `*Attributes` なのは、**子のまとまりを更新に紛れ込ませない**
 * ため。子は子の action で足し引きする。
 */
export type AnswerSheetAction =
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_DEFINITION"; payload: AnswerSheetDefinition }
  | { type: "UPDATE_DEFINITION"; payload: AsbDefinitionUpdate }
  // 表示の切り替えで、編集ではない（履歴に積まない）ので UPDATE_DEFINITION と分ける
  | { type: "SET_RENDER_MODE"; payload: RenderMode }
  | {
      type: "APPLY_LABEL_PRESET"
      payload: { category: LabelCategory; preset: string }
    }
  | {
      type: "ADD_HEADER_FIELD"
      payload: { headerField: HeaderFieldDefinition }
    }
  | {
      type: "UPDATE_HEADER_FIELD"
      payload: {
        headerFieldId: string
        data: Partial<AsbHeaderFieldAttributes>
      }
    }
  | { type: "DELETE_HEADER_FIELD"; payload: { headerFieldId: string } }
  | { type: "REORDER_HEADER_FIELDS"; payload: { orderedIds: string[] } }
  | { type: "ADD_MAJOR_QUESTION"; payload: { majorQuestion: MajorQuestion } }
  | {
      type: "UPDATE_MAJOR_QUESTION"
      payload: {
        majorQuestionId: string
        data: Partial<AsbMajorQuestionAttributes>
      }
    }
  | { type: "DELETE_MAJOR_QUESTION"; payload: { majorQuestionId: string } }
  | { type: "REORDER_MAJOR_QUESTIONS"; payload: { orderedIds: string[] } }
  | {
      type: "ADD_SUB_QUESTION"
      payload: { majorQuestionId: string; subQuestion: SubQuestion }
    }
  | {
      type: "UPDATE_SUB_QUESTION"
      payload: { subQuestionId: string; data: AsbSubQuestionUpdate }
    }
  | { type: "DELETE_SUB_QUESTION"; payload: { subQuestionId: string } }
  | {
      type: "REORDER_SUB_QUESTIONS"
      payload: { majorQuestionId: string; orderedIds: string[] }
    }
  | {
      type: "ADD_BRANCH_QUESTION"
      payload: { subQuestionId: string; branchQuestion: BranchQuestion }
    }
  | {
      type: "UPDATE_BRANCH_QUESTION"
      payload: {
        branchQuestionId: string
        data: Partial<AsbBranchQuestionAttributes>
      }
    }
  | { type: "DELETE_BRANCH_QUESTION"; payload: { branchQuestionId: string } }
  | {
      type: "REORDER_BRANCH_QUESTIONS"
      payload: { subQuestionId: string; orderedIds: string[] }
    }
  | {
      type: "ADD_TEXT_ELEMENT"
      payload: { parent: AsbCellParent; textElement: CellTextElement }
    }
  | {
      type: "UPDATE_TEXT_ELEMENT"
      payload: {
        textElementId: string
        data: Partial<AsbTextElementAttributes>
      }
    }
  | { type: "DELETE_TEXT_ELEMENT"; payload: { textElementId: string } }
  | {
      type: "ADD_IMAGE_ELEMENT"
      payload: { parent: AsbCellParent; imageElement: CellImageElement }
    }
  | {
      type: "UPDATE_IMAGE_ELEMENT"
      payload: {
        imageElementId: string
        data: Partial<AsbImageElementAttributes>
      }
    }
  | { type: "DELETE_IMAGE_ELEMENT"; payload: { imageElementId: string } }
  | {
      type: "ADD_CHAR_GUIDE"
      payload: { subQuestionId: string; charGuide: ManuscriptCharGuide }
    }
  | {
      type: "UPDATE_CHAR_GUIDE"
      payload: { charGuideId: string; data: Partial<AsbCharGuideAttributes> }
    }
  | { type: "DELETE_CHAR_GUIDE"; payload: { charGuideId: string } }
  | {
      type: "UPSERT_OMR_CONFIG"
      payload: { parent: AsbCellParent; config: OMRCellConfig }
    }
  | { type: "DELETE_OMR_CONFIG"; payload: { parent: AsbCellParent } }
