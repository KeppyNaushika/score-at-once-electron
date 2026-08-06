/**
 * @fileoverview 描画アノテーション型定義
 * @description 全描画ツール（テキスト・直線・長方形・楕円）の統合型定義
 */
import type {
  DrawingAnnotation as PrismaDrawingAnnotation,
  Prisma,
} from "@prisma/client"

import type { annotationWithContextInclude } from "@/electron-src/lib/prisma/drawingAnnotation"

import type { Serialized } from "./prismaExtensions"
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
type AnnotationHorizontalAlign = (typeof ANNOTATION_HORIZONTAL_ALIGNS)[number]

const ANNOTATION_VERTICAL_ALIGNS = ["top", "center", "bottom"] as const
type AnnotationVerticalAlign = (typeof ANNOTATION_VERTICAL_ALIGNS)[number]

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

/**
 * 未保存の1行を作る。
 *
 * 作成も更新も行そのものを渡すので、専用の入力型は無い（かつては
 * `DrawingCreateData` / `DrawingUpdateData` があったが、Canvas が行を写した
 * 独自 view を持っていたための変換用で、行を持てば不要になった）。
 *
 * 既定値は `schema.prisma` の `@default` と同じ値にする。列を足したときは
 * 返り値の型（＝ Prisma のモデル）が欠落を検査するので、ここへ既定値を書き足す
 * まで型が通らない。手書きの入力型のように値が黙って落ちることが無い。
 */
export function newDrawingAnnotation(
  seed: Partial<DrawingAnnotation> &
    Pick<DrawingAnnotation, "questionScoreId" | "type" | "x" | "y">
): DrawingAnnotation {
  const now = new Date()
  return {
    id: crypto.randomUUID(),
    color: "#ef4444",
    // 線幅・文字サイズは mm（用紙サイズ基準）
    strokeWidth: 0.5,
    width: 0.0,
    height: 0.0,
    endX: 0.0,
    endY: 0.0,
    lineStyle: "solid",
    text: "",
    fontSize: 4.0,
    textBoxWidth: 0.0,
    textBoxHeight: 0.0,
    horizontalAlign: "left",
    verticalAlign: "top",
    anchorDirection: "top-left",
    displayX: 0.0,
    displayY: 0.0,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
    ...seed,
  }
}

// QuestionScore情報を含む拡張型（アノテーションブラウズパネル用）
/**
 * 作成者と設問の文脈まで同梱したアノテーション。
 * 形の SSOT は取得側の include（`annotationWithContextInclude`）で、ここでは導出だけを行う。
 * 取得経路は `serializePrisma` を通して IPC へ返すので、同梱した QuestionScore の
 * `partialScore` は Decimal ではなく number。`Serialized<>` を被せて実体と型を揃える。
 */
export type AnnotationWithContext = NarrowAnnotationUnions<
  Serialized<
    Prisma.DrawingAnnotationGetPayload<{
      include: typeof annotationWithContextInclude
    }>
  >
>
