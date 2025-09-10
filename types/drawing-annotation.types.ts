/**
 * @fileoverview 描画アノテーション型定義
 * @description 全描画ツール（テキスト・直線・長方形・楕円）の統合型定義
 */

// 基本型定義
export type DrawingType = "text" | "line" | "rectangle" | "ellipse"
export type LineStyle = "solid" | "wave" | "zigzag" | "double" | "arrow" | "both_arrow"
export type HorizontalAlign = "left" | "center" | "right"
export type VerticalAlign = "top" | "center" | "bottom"

// データベース対応統合インターフェース
export interface DrawingAnnotation {
  id: string
  questionScoreId: string
  type: DrawingType
  
  // 基本プロパティ（全要素共通）
  x: number          // 0.0 - 1.0 相対座標
  y: number          // 0.0 - 1.0
  color: string
  strokeWidth: number
  
  // サイズプロパティ
  width: number      // 0.0 - 1.0
  height: number     // 0.0 - 1.0
  
  // 直線専用プロパティ
  endX: number       // 0.0 - 1.0
  endY: number       // 0.0 - 1.0
  lineStyle: LineStyle
  
  // テキスト専用プロパティ
  text: string
  fontSize: number
  textBoxWidth: number     // 0.0 - 1.0
  textBoxHeight: number    // 0.0 - 1.0
  horizontalAlign: HorizontalAlign
  verticalAlign: VerticalAlign
  
  // 表示プロパティ
  displayX: number    // 0.0 - 1.0
  displayY: number    // 0.0 - 1.0
  
  // メタデータ
  createdAt: Date
  updatedAt: Date
  createdByUserId?: string | null
}

// 作成用データ型
export interface DrawingCreateData {
  questionScoreId: string
  type: DrawingType
  x: number
  y: number
  color?: string
  strokeWidth?: number
  
  // 全プロパティ（デフォルト値はデータベース側で設定）
  width?: number
  height?: number
  endX?: number
  endY?: number
  lineStyle?: LineStyle
  text?: string
  fontSize?: number
  textBoxWidth?: number
  textBoxHeight?: number
  horizontalAlign?: HorizontalAlign
  verticalAlign?: VerticalAlign
  displayX?: number
  displayY?: number
  createdByUserId?: string | null
}

// 更新用データ型
export interface DrawingUpdateData {
  x?: number
  y?: number
  color?: string
  strokeWidth?: number
  width?: number
  height?: number
  endX?: number
  endY?: number
  lineStyle?: LineStyle
  text?: string
  fontSize?: number
  textBoxWidth?: number
  textBoxHeight?: number
  horizontalAlign?: HorizontalAlign
  verticalAlign?: VerticalAlign
  displayX?: number
  displayY?: number
}

// 型ガード関数
export function isTextAnnotation(annotation: DrawingAnnotation): boolean {
  return annotation.type === "text"
}

export function isLineAnnotation(annotation: DrawingAnnotation): boolean {
  return annotation.type === "line"
}

export function isShapeAnnotation(annotation: DrawingAnnotation): boolean {
  return annotation.type === "rectangle" || annotation.type === "ellipse"
}

// 既存DrawingElementとの互換性用型
export interface DrawingElementLegacy {
  id: string
  type: "text" | "line" | "rectangle" | "ellipse"
  x: number
  y: number
  width?: number
  height?: number
  endX?: number
  endY?: number
  text?: string
  color: string
  strokeWidth: number
  lineStyle?: LineStyle
  fontSize?: number
  textBoxWidth?: number
  textBoxHeight?: number
  displayX?: number
  displayY?: number
}

// バッチ操作用型
export interface DrawingBatchCreateData {
  annotations: DrawingCreateData[]
}

export interface DrawingBatchUpdateData {
  updates: Array<{ id: string; data: DrawingUpdateData }>
}

// 統計情報用型
export interface DrawingAnnotationStats {
  total: number
  byType: Record<DrawingType, number>
}

// レスポンス用型
export interface DrawingAnnotationResponse {
  success: boolean
  data?: DrawingAnnotation | DrawingAnnotation[]
  error?: string
}