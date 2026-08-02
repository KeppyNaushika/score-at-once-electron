/**
 * @fileoverview 描画アノテーション型定義
 * @description 全描画ツール（テキスト・直線・長方形・楕円）の統合型定義
 */
import type {
  DrawingAnnotation as PrismaDrawingAnnotation,
  Prisma,
} from "@prisma/client"

import type {
  annotationWithAuthorInclude,
  annotationWithContextInclude,
} from "@/electron-src/lib/prisma/drawingAnnotation"

import { defineStringUnion } from "./stringUnion"

// 基本型定義
/**
 * 描画種別。SQLite に enum が無いため DB 上は String 列で、境界で `toDrawingType`
 * を通して literal union へ絞り込む（Decimal→number / ScoringStatus と同じ型注入）。
 */
export const DRAWING_TYPES = ["text", "line", "rectangle", "ellipse"] as const
export type DrawingType = (typeof DRAWING_TYPES)[number]

/**
 * `is` は「描ける種別か」の判定に使う。既定値の `"line"` へ倒すと、終点を持たない行
 * （endX/endY は既定の 0.0）が原点への線として描かれてしまうため、読み取りの境界では
 * 倒す前に未知の行を落とす（`narrowDrawableAnnotations`）。
 */
export const { is: isDrawingType, to: toDrawingType } = defineStringUnion(
  DRAWING_TYPES,
  "line"
)

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

/**
 * 読み取りの境界で使う。描けない種別の行を落としてから union を絞る。
 *
 * `type` 以外の union 列（線種・揃え・アンカー）は既定へ倒しても見た目が既定に
 * なるだけで済むが、`type` だけは「何を描くか」そのものなので倒してはいけない。
 * 未知の種別（旧バージョンで作られた行・取り込み・DB の直接編集）を既定の `"line"`
 * へ倒すと、終点を持たない行が答案の原点へ向かう線として描かれる。
 *
 * 落とした件数は呼び出し側で警告する（黙って減らさない）。
 */
export const narrowDrawableAnnotations = <
  T extends {
    type: string
    lineStyle: string
    horizontalAlign: string
    verticalAlign: string
    anchorDirection: string
  },
>(
  rows: T[]
) => rows.filter((row) => isDrawingType(row.type)).map(narrowAnnotationUnions)

/** SQLite に enum が無いため DB 上 String で保存されている列 */
type AnnotationUnionColumn =
  "type" | "lineStyle" | "horizontalAlign" | "verticalAlign" | "anchorDirection"

/**
 * DB 行の String union 列だけを literal union へ差し替える型注入。
 *
 * SQLite に enum が無いため DB 上はすべて String で、列そのものは Prisma の生成型に
 * 追随させる（Prisma が管理する形を手書きで複製しない）。
 */
type NarrowAnnotationUnions<T> = Omit<T, AnnotationUnionColumn> & {
  type: DrawingType
  lineStyle: LineStyle
  horizontalAlign: AnnotationHorizontalAlign
  verticalAlign: AnnotationVerticalAlign
  anchorDirection: AnchorDirection
}

/** 描画アノテーション1行（Prisma のモデルに union 型注入だけを施したもの） */
export type DrawingAnnotation = NarrowAnnotationUnions<PrismaDrawingAnnotation>

/** 作成者（＝親 QuestionScore の採点者）を同梱したアノテーション */
export type AnnotationWithAuthor = NarrowAnnotationUnions<
  Prisma.DrawingAnnotationGetPayload<{
    include: typeof annotationWithAuthorInclude
  }>
>

/**
 * 作成用データ。
 *
 * Prisma の入力型（`DrawingAnnotationUncheckedCreateInput`）からは導出しない。
 * 更新側（下記）が `{ set }` / `{ increment }` を通してしまうのと対で、入力の形を
 * Prisma に預けると IPC の契約が Prisma の都合で決まってしまう。
 *
 * ただしこの型が手書きで済んでいるのは**暫定**である。送り元の Canvas が
 * `DrawingElement`（DB 行を写した独自 view）を持っているためで、Canvas が行を
 * そのまま持てばこの型自体が不要になる。→ issue 参照
 */
export interface DrawingCreateData {
  /** フロントエンドで生成した UUID を使える（未指定なら DB 側で採番） */
  id?: string
  /** 必須。QuestionScore は事前に作成されている必要がある */
  questionScoreId: string
  type: DrawingType
  x: number
  y: number
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
}

/**
 * 更新用データ。
 *
 * Prisma の `DrawingAnnotationUncheckedUpdateInput` から導出してはならない。
 * あの型は各列が「素の値」か `{ set }` / `{ increment }`（原子更新操作）のどちらでも
 * よい union なので、導出すると操作オブジェクトが IPC を通る。更新処理は `...data` を
 * そのまま Prisma へ渡すため実際に効いてしまい、監査ログの `typeof data.text === "string"`
 * を素通りして記録だけが欠ける。
 *
 * 作成用と同じく、Canvas が行をそのまま持てばこの型は不要になる。→ issue 参照
 */
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

// QuestionScore情報を含む拡張型（アノテーションブラウズパネル用）
/**
 * 作成者と設問の文脈まで同梱したアノテーション。
 * 形の SSOT は取得側の include（`annotationWithContextInclude`）で、ここでは導出だけを行う。
 */
export type AnnotationWithContext = NarrowAnnotationUnions<
  Prisma.DrawingAnnotationGetPayload<{
    include: typeof annotationWithContextInclude
  }>
>
