/**
 * ルーブリック採点（教員の層）の、DB に String で保存する列の値の集合の唯一の定義源
 * （docs/vlm-grading-design.md §4・§5-2）。
 *
 * SQLite(Prisma) は enum を持たないので、`CropRegion.scoringMethod`・`RubricItem.effectKind`・
 * `RubricItem.setStatus`・`RubricAdviceCombination.mode` が取りうる値はここにしか無い。
 * 段階評価（§4-8）を足すときは、採点方式に `scale` を足す。
 */

import type { RubricItem } from "@prisma/client"

import type { Serialized } from "./prismaExtensions"
import { defineStringUnion } from "./stringUnion"

/**
 * 設問の採点方式。points は採点キー・部分点で直接付ける今の採点（既定）。
 * deduction は配点から当たった項目の減点を引き、addition は0点から加点を足す。
 * 外れ値は points に倒す（項目からの計算で点を書き換えない側）
 */
export const SCORING_METHODS = ["points", "deduction", "addition"] as const
export type ScoringMethod = (typeof SCORING_METHODS)[number]
export const { is: isScoringMethod, to: toScoringMethod } = defineStringUnion(
  SCORING_METHODS,
  "points"
)

/** 項目の効き方。adjust は点を加減し、set は判定と点を決める（加減より優先する） */
export const RUBRIC_EFFECT_KINDS = ["adjust", "set"] as const
export type RubricEffectKind = (typeof RUBRIC_EFFECT_KINDS)[number]
export const { is: isRubricEffectKind, to: toRubricEffectKind } =
  defineStringUnion(RUBRIC_EFFECT_KINDS, "adjust")

/**
 * set の項目が決める判定（ScoringStatus のうちの5つ。§6-4）。
 * `unscored`・`double_mark` は項目では決めない
 */
export const RUBRIC_SET_STATUSES = [
  "correct",
  "partial",
  "incorrect",
  "no_answer",
  "pending",
] as const
export type RubricSetStatus = (typeof RUBRIC_SET_STATUSES)[number]
export const { is: isRubricSetStatus } = defineStringUnion(
  RUBRIC_SET_STATUSES,
  "pending"
)

/**
 * 助言を持つ項目が2つ以上当たったときの朱書きの決まり（§4-7）。
 * merged はまとめた一文、single は1つの項目の助言だけ、all は並べる、none は朱書きなし
 */
export const RUBRIC_ADVICE_COMBINATION_MODES = [
  "merged",
  "single",
  "all",
  "none",
] as const
export type RubricAdviceCombinationMode =
  (typeof RUBRIC_ADVICE_COMBINATION_MODES)[number]
export const {
  is: isRubricAdviceCombinationMode,
  to: toRubricAdviceCombinationMode,
} = defineStringUnion(RUBRIC_ADVICE_COMBINATION_MODES, "all")

/**
 * AI へ送る文（`rubricItemsText.ts`）と1段目・2段目が読む、ルーブリック項目の値。
 * 境界を越えた RubricItem（Decimal は数）の列から、種類と判定を値の集合へ絞ったもの
 */
export type RubricItemForPrompt = Readonly<
  Omit<
    Pick<
      Serialized<RubricItem>,
      "id" | "label" | "effectKind" | "pointDelta" | "setStatus" | "setScore"
    >,
    "effectKind" | "setStatus"
  > & {
    effectKind: RubricEffectKind
    setStatus: RubricSetStatus | null
  }
>
