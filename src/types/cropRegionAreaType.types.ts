/**
 * 採点領域タイプ（CropRegion.type）の単一の真実源（Single Source of Truth）。
 *
 * SQLite(Prisma) は enum 非対応のため `CropRegion.type` は `String` で保存され、
 * 値の集合を型で保証できるのはこの TypeScript 定義のみ。02-template（領域作成）と
 * 03-region-info（領域情報）の双方がこの1ファイルから導出すること
 * （scoringStatus.types.ts / examStudentStatus.types.ts と同型のパターン）。
 */
import { defineStringUnion } from "./stringUnion"

export const CROP_REGION_AREA_TYPES = [
  "QUESTION_ANSWER",
  "STUDENT_NAME",
  "STUDENT_ID",
  "TOTAL_SCORE",
  "SUBTOTAL_SCORE",
  "MARK",
  "COMMENT",
  "OTHER",
] as const

export type CropRegionAreaType = (typeof CROP_REGION_AREA_TYPES)[number]

/**
 * 型ガード `isCropRegionAreaType` と境界コンバータ `toCropRegionAreaType`
 * （想定外値は OTHER）。DB 上は String 保存のため境界で narrowing する。
 */
export const { is: isCropRegionAreaType, to: toCropRegionAreaType } =
  defineStringUnion(CROP_REGION_AREA_TYPES, "OTHER")
