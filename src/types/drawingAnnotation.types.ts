/**
 * @fileoverview 描画アノテーション型定義
 * @description 全描画ツール（テキスト・直線・長方形・楕円）の統合型定義
 */
import { defineStringUnion } from "./stringUnion"

// 基本型定義
/**
 * 描画種別。SQLite に enum が無いため DB 上は String 列で、境界で `toDrawingType`
 * を通して literal union へ絞り込む（Decimal→number / ScoringStatus と同じ型注入）。
 */
export const DRAWING_TYPES = ["text", "line", "rectangle", "ellipse"] as const
export type DrawingType = (typeof DRAWING_TYPES)[number]

export const { to: toDrawingType } = defineStringUnion(DRAWING_TYPES, "line")

export const LINE_STYLES = [
  "solid",
  "wave",
  "zigzag",
  "double",
  "arrow",
  "both_arrow",
] as const
export type LineStyle = (typeof LINE_STYLES)[number]

const ANNOTATION_HORIZONTAL_ALIGNS = ["left", "center", "right"] as const
export type AnnotationHorizontalAlign =
  (typeof ANNOTATION_HORIZONTAL_ALIGNS)[number]

const ANNOTATION_VERTICAL_ALIGNS = ["top", "center", "bottom"] as const
export type AnnotationVerticalAlign =
  (typeof ANNOTATION_VERTICAL_ALIGNS)[number]

export const ANCHOR_DIRECTIONS = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
] as const
export type AnchorDirection = (typeof ANCHOR_DIRECTIONS)[number]

/**
 * 型ガードと境界コンバータ。想定外値は既定へ倒す（DB 直書き・旧データへの耐性）。
 * scoringStatus.types.ts / cropRegionAreaType.types.ts と同じ factory から生成する。
 */
export const { to: toLineStyle } = defineStringUnion(LINE_STYLES, "solid")
export const { to: toAnnotationHorizontalAlign } = defineStringUnion(
  ANNOTATION_HORIZONTAL_ALIGNS,
  "left"
)
export const { to: toAnnotationVerticalAlign } = defineStringUnion(
  ANNOTATION_VERTICAL_ALIGNS,
  "top"
)
export const { to: toAnchorDirection } = defineStringUnion(
  ANCHOR_DIRECTIONS,
  "top-left"
)

/**
 * DB 行（union 列がすべて String）を境界で 1 回だけ絞り込む。
 * SQLite に enum が無いための型注入で、`as` で潰さずここを通すことで
 * include の形が変わったときに型検査が効く。
 */
export const narrowAnnotationUnions = <
  T extends {
    type: string
    lineStyle: string
    horizontalAlign: string
    verticalAlign: string
    anchorDirection: string
  },
>(
  row: T
) => ({
  ...row,
  type: toDrawingType(row.type),
  lineStyle: toLineStyle(row.lineStyle),
  horizontalAlign: toAnnotationHorizontalAlign(row.horizontalAlign),
  verticalAlign: toAnnotationVerticalAlign(row.verticalAlign),
  anchorDirection: toAnchorDirection(row.anchorDirection),
})

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
  horizontalAlign: AnnotationHorizontalAlign
  verticalAlign: AnnotationVerticalAlign

  // テキストボックス統合フィールド
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
  examStudentId?: string
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
  horizontalAlign?: AnnotationHorizontalAlign
  verticalAlign?: AnnotationVerticalAlign
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
  horizontalAlign?: AnnotationHorizontalAlign
  verticalAlign?: AnnotationVerticalAlign
  anchorDirection?: AnchorDirection
  displayX?: number
  displayY?: number
  isFavorite?: boolean
}

// 統計情報用型
export interface DrawingAnnotationStats {
  total: number
  byType: Record<DrawingType, number>
}

// QuestionScore情報を含む拡張型（アノテーションブラウズパネル用）
export interface AnnotationWithContext extends DrawingAnnotation {
  questionScore?: {
    id: string
    examStudentId: string
    cropRegionId: string
    cropRegion?: { id: string; label: string }
    examStudent?: {
      id: string
      student: {
        id: string
        studentNumber: string
        lastName: string
        firstName: string
      }
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
