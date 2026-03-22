/**
 * @fileoverview 描画アノテーション型定義
 * @description 全描画ツール（テキスト・直線・長方形・楕円）の統合型定義
 */

// 基本型定義
export type DrawingType = "text" | "line" | "rectangle" | "ellipse"
export type DrawingTool = "select" | "text" | "line" | "rectangle" | "ellipse"
export type LineStyle =
  | "solid"
  | "wave"
  | "zigzag"
  | "double"
  | "arrow"
  | "both_arrow"
export type HorizontalAlign = "left" | "center" | "right"
export type VerticalAlign = "top" | "center" | "bottom"
export type AnchorDirection =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right"

// データベース対応統合インターフェース
export interface DrawingAnnotation {
  id: string
  questionScoreId: string
  type: DrawingType

  // 基本プロパティ（全要素共通）
  x: number // 0.0 - 1.0 相対座標
  y: number // 0.0 - 1.0
  color: string
  strokeWidth: number

  // サイズプロパティ
  width: number // 0.0 - 1.0
  height: number // 0.0 - 1.0

  // 直線専用プロパティ
  endX: number // 0.0 - 1.0
  endY: number // 0.0 - 1.0
  lineStyle: LineStyle

  // テキスト専用プロパティ
  text: string
  fontSize: number
  textBoxWidth: number // 0.0 - 1.0
  textBoxHeight: number // 0.0 - 1.0
  horizontalAlign: HorizontalAlign
  verticalAlign: VerticalAlign

  // V4統合フィールド
  anchorDirection: AnchorDirection

  // 表示プロパティ
  displayX: number // 0.0 - 1.0
  displayY: number // 0.0 - 1.0

  // お気に入り
  isFavorite: boolean

  // メタデータ
  createdAt: Date
  updatedAt: Date
  userId: string
}

// 作成用データ型
export interface DrawingCreateData {
  id?: string // フロントエンドで生成したUUIDを使用可能（指定なしの場合はDB側で自動生成）
  questionScoreId: string // 必須: QuestionScoreは事前に作成されている必要がある
  type: DrawingType
  x: number
  y: number
  color?: string
  strokeWidth?: number

  // コンテキスト情報（参照用、自動作成には使用しない）
  studentId?: string
  cropRegionId?: string

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
  anchorDirection?: AnchorDirection
  displayX?: number
  displayY?: number
  userId: string
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
  anchorDirection?: AnchorDirection
  displayX?: number
  displayY?: number
  isFavorite?: boolean
}

/** アノテーションがテキスト型かどうかを判定する型ガード */
export function isTextAnnotation(annotation: DrawingAnnotation): boolean {
  return annotation.type === "text"
}

/** アノテーションが直線型かどうかを判定する型ガード */
export function isLineAnnotation(annotation: DrawingAnnotation): boolean {
  return annotation.type === "line"
}

/** アノテーションが図形型（長方形または楕円）かどうかを判定する型ガード */
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

// QuestionScore情報を含む拡張型（アノテーションブラウズパネル用）
export interface AnnotationWithContext extends DrawingAnnotation {
  questionScore?: {
    id: string
    studentId: string
    cropRegionId: string
    cropRegion?: { id: string; label: string }
    student?: {
      id: string
      studentNumber: string
      lastName: string
      firstName: string
    }
  } | null
  user?: {
    id: string
    username: string
    name: string | null
  } | null
}

// QuestionScore情報を含む拡張型（透明度制御用）
export interface DrawingAnnotationWithQuestionScore extends DrawingAnnotation {
  questionScore?: {
    id: string
    cropRegionId: string
    cropRegion?: {
      id: string
      label: string
    }
  } | null
  user?: {
    id: string
    username: string
    name: string | null
  } | null
}
