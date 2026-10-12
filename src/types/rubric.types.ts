/**
 * ルーブリック採点（教員の層）の、DB に String で保存する列の値の集合の唯一の定義源
 * （docs/vlm-grading-design.md §4・§5-2）。
 *
 * SQLite(Prisma) は enum を持たないので、`CropRegion.scoringMethod`・`RubricItem.effectKind`・
 * `RubricItem.setStatus`・`RubricAdviceCombination.mode` が取りうる値はここにしか無い。
 */

import type { RubricItem } from "@prisma/client"

import type { Serialized } from "./prismaExtensions"
import type { ScoringStatus } from "./scoringStatus.types"
import { defineStringUnion } from "./stringUnion"

/**
 * 設問の採点方式。points は採点キー・部分点で直接付ける今の採点（既定）。
 * deduction は配点から当たった項目の減点を引き、addition は0点から加点を足す。
 * scale は類型評価（A/B/C。§4-8）で、類型が評価そのもの・点は類型の点数から導く。
 * 外れ値は points に倒す（項目からの計算で点を書き換えない側）
 */
export const SCORING_METHODS = [
  "points",
  "deduction",
  "addition",
  "scale",
] as const
export type ScoringMethod = (typeof SCORING_METHODS)[number]
export const { is: isScoringMethod, to: toScoringMethod } = defineStringUnion(
  SCORING_METHODS,
  "points"
)

/**
 * 採点項目を当てて採点する方式か（減点・加点方式と類型方式）。正誤方式だけは項目から点を決めず、
 * 採点キーと部分点で付ける。類型方式では、類型にする項目を当てるとその類型になる（§4-8-6）
 */
export const scoresFromRubricItems = (
  scoringMethod: ScoringMethod
): scoringMethod is "deduction" | "addition" | "scale" =>
  scoringMethod !== "points"

/**
 * 当たった項目の加減から点を計算する方式か（減点・加点方式）。
 * 直接採点と類型評価は、項目から部分点を計算しない（配点を変えても点を計算し直さない）
 */
export const computesScoreFromRubricItems = (
  scoringMethod: ScoringMethod
): scoringMethod is "deduction" | "addition" =>
  scoringMethod === "deduction" || scoringMethod === "addition"

/**
 * 正誤の評価（正答・誤答・部分点）。類型評価の設問ではこれを付けず、付いていても得点にしない
 * （方式と合わない採点。§4-8-2・§4-8-8）
 */
const POINT_VERDICT_STATUSES: ReadonlySet<string> = new Set([
  "correct",
  "incorrect",
  "partial",
])

/**
 * その採点の状態が設問の方式と合うか。類型評価の設問の正答・誤答・部分点と、点の採点の設問の
 * 評価済み（`evaluated`）は合わない。進み具合（未採点・保留）と答案の状態（無答・Wマーク）は
 * どの方式でも合う
 */
export const isStatusCompatibleWithScoringMethod = (
  scoringMethod: ScoringMethod,
  status: string
): boolean =>
  scoringMethod === "scale"
    ? !POINT_VERDICT_STATUSES.has(status)
    : status !== "evaluated"

/**
 * 方式と合わない採点を未採点として読む。行は DB に残すだけで、採点済みにも数えず、画面にも出力にも
 * 出さない。方式を戻したときにだけ、元の採点として表に出る（docs/vlm-grading-design.md §4-8-8）。
 * 採点行の状態を読む所（解決・進み具合・表示・出力）は、生の status でなくこれを通す
 */
export const isScoreCountedForScoringMethod = (
  scoringMethod: string,
  status: string
): boolean =>
  isStatusCompatibleWithScoringMethod(toScoringMethod(scoringMethod), status)

/** 方式と合わない採点を未採点に読み替えた状態（{@link isScoreCountedForScoringMethod}） */
export const countedStatusOf = (
  scoringMethod: string,
  status: ScoringStatus
): ScoringStatus =>
  isScoreCountedForScoringMethod(scoringMethod, status) ? status : "unscored"

/**
 * 類型評価の値の見せ方（§4-8-8）。points は「8」（点数だけ）、label_points は「A (8)」（記号と点数）、
 * label は「A」（記号だけ）。外部資料の今の表示に合わせて label_points を既定にする
 */
export const SCALE_VALUE_DISPLAYS = ["points", "label_points", "label"] as const
export type ScaleValueDisplay = (typeof SCALE_VALUE_DISPLAYS)[number]
export const { is: isScaleValueDisplay, to: toScaleValueDisplay } =
  defineStringUnion(SCALE_VALUE_DISPLAYS, "label_points")

/** 項目の効き方。adjust は点を加減し、set は判定と点を決める（加減より優先する） */
export const RUBRIC_EFFECT_KINDS = ["adjust", "set"] as const
export type RubricEffectKind = (typeof RUBRIC_EFFECT_KINDS)[number]
export const { is: isRubricEffectKind, to: toRubricEffectKind } =
  defineStringUnion(RUBRIC_EFFECT_KINDS, "adjust")

/**
 * set の項目が決める判定（ScoringStatus のうちの6つ。§6-4・§4-8-6）。
 * `unscored`・`double_mark` は項目では決めない。`evaluated`（類型にする）は類型方式の設問だけで、
 * 正答・部分点・誤答は類型方式でない設問だけで使う（{@link rubricSetStatusesFor}）
 */
export const RUBRIC_SET_STATUSES = [
  "correct",
  "partial",
  "incorrect",
  "no_answer",
  "pending",
  "evaluated",
] as const
export type RubricSetStatus = (typeof RUBRIC_SET_STATUSES)[number]
export const { is: isRubricSetStatus } = defineStringUnion(
  RUBRIC_SET_STATUSES,
  "pending"
)

/** 設問の方式で set の項目が決められる判定（方式と合う判定だけ。並びは画面のボタンの順） */
export const rubricSetStatusesFor = (
  scoringMethod: ScoringMethod
): readonly RubricSetStatus[] =>
  RUBRIC_SET_STATUSES.filter((status) =>
    isStatusCompatibleWithScoringMethod(scoringMethod, status)
  )

/**
 * 助言を持つ項目が2つ以上当たったときの朱書きの決まり（§4-7）。
 * merged はまとめた一文、single は1つの項目の助言だけ、all は並べる、none は朱書きなし
 */
const RUBRIC_ADVICE_COMBINATION_MODES = [
  "merged",
  "single",
  "all",
  "none",
] as const
export type RubricAdviceCombinationMode =
  (typeof RUBRIC_ADVICE_COMBINATION_MODES)[number]
export const { is: isRubricAdviceCombinationMode } = defineStringUnion(
  RUBRIC_ADVICE_COMBINATION_MODES,
  "all"
)

/**
 * AI へ送る文（`rubricItemsText.ts`）と1段目・2段目が読む、ルーブリック項目の値。
 * 境界を越えた RubricItem（Decimal は数）の列から、種類と判定を値の集合へ絞ったもの
 */
export type RubricItemForPrompt = Readonly<
  Omit<
    Pick<
      Serialized<RubricItem>,
      | "id"
      | "label"
      | "effectKind"
      | "pointDelta"
      | "setStatus"
      | "setScore"
      | "setScaleLevelId"
    >,
    "effectKind" | "setStatus"
  > & {
    effectKind: RubricEffectKind
    setStatus: RubricSetStatus | null
  }
>
