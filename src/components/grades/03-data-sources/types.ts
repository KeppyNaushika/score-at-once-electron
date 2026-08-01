import type { GradeDataSourceType } from "@/types/grade.types"
import { defineStringUnion } from "@/types/stringUnion"

/**
 * データソース追加フォームで直接選べる種別。
 *
 * ドメインの {@link GradeDataSourceType} の部分集合。`coursework_total` は「資料全体」を
 * 選んだときに送信時へ振り替えるため、`manual` は旧データ専用のため、どちらも選択肢に出さない。
 */
const ADD_DATA_SOURCE_TYPES = [
  "exam_total",
  "subtotal",
  "crop_region",
  "coursework",
] as const satisfies readonly GradeDataSourceType[]

export type AddDataSourceType = (typeof ADD_DATA_SOURCE_TYPES)[number]

/** Select が返す string を選択肢の種別へ絞り込む。想定外値は既定の「全設問合計」へ倒す。 */
export const { to: toAddDataSourceType } = defineStringUnion(
  ADD_DATA_SOURCE_TYPES,
  "exam_total"
)

/** 資料の評価項目セレクトで「資料全体（全項目合計）」を表すセンチネル値 */
export const COURSEWORK_WHOLE = "__whole__"

export interface ExamOption {
  id: string
  examName: string
  examDate: Date | null
}

export interface SubtotalGroupOption {
  id: string
  name: string
  subtotals: { id: string; name: string; order: number }[]
}

export interface CropRegionOption {
  id: string
  label: string
  points: number | null
  /** 小計への割り当て。満点の算出に使う */
  cropSubtotals: { subtotalId: string }[]
}

export interface CourseworkOption {
  id: string
  name: string
  date: string | null
  items: {
    id: string
    name: string
    maxScore: number
    inputMode: string
    order: number
  }[]
}

/** データソース追加フォームの選択状態。名前と換算満点の既定値を導く入力になる。 */
export interface AddDataSourceSelection {
  type: AddDataSourceType
  examId: string
  subtotalId: string
  cropRegionId: string
  courseworkId: string
  courseworkItemId: string
}

/** 2つの選択状態が同じものを指すか。入力中の下書きがまだ有効かの判定に使う。 */
export function isSameSelection(
  selection: AddDataSourceSelection,
  other: AddDataSourceSelection
): boolean {
  return (
    selection.type === other.type &&
    selection.examId === other.examId &&
    selection.subtotalId === other.subtotalId &&
    selection.cropRegionId === other.cropRegionId &&
    selection.courseworkId === other.courseworkId &&
    selection.courseworkItemId === other.courseworkItemId
  )
}
