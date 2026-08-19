/**
 * 連続クリックでの採点（2〜4回）に割り当てる動作の唯一の定義源。
 *
 * 割り当ては利用者ごと・クリック回数ごとに1行（`UserClickScoringAction`）で持つ。
 * DB の列は `String` なので、値の集合を保証できるのはこの TypeScript 定義だけ。
 */

import type { UserClickScoringAction } from "@prisma/client"

import { defineStringUnion } from "./stringUnion"

export const CLICK_SCORING_ACTIONS = [
  "none",
  "correct",
  "incorrect",
  "partial",
  "partial_modal",
  "pending",
  "unscored",
  "no_answer",
  "double_mark",
  "individual",
] as const

export type ClickScoringAction = (typeof CLICK_SCORING_ACTIONS)[number]

/** 保存値・入力値を動作へ倒す。知らない値は「なし」に落とす */
export const { to: toClickScoringAction } = defineStringUnion(
  CLICK_SCORING_ACTIONS,
  "none"
)

/** クリック回数ごとの動作。画面はこの形で引く */
export interface ClickScoringConfig {
  2: ClickScoringAction
  3: ClickScoringAction
  4: ClickScoringAction
}

export const DEFAULT_CLICK_SCORING_CONFIG: ClickScoringConfig = {
  2: "incorrect",
  3: "partial_modal",
  4: "individual",
}

/**
 * 保存されている行を、クリック回数で引ける形へ畳む。
 *
 * **行が無い回数は既定のまま。** 行の値をそのまま広げると、壊れた値が
 * `ClickScoringAction` を名乗ったまま通る（DB の列は文字列で、中身を型は知らない）ので、
 * 回数ごとに1つずつ union へ倒す。
 */
export function toClickScoringConfig(
  rows: UserClickScoringAction[]
): ClickScoringConfig {
  const actionOf = (clickCount: 2 | 3 | 4): ClickScoringAction => {
    const row = rows.find((candidate) => candidate.clickCount === clickCount)
    if (!row) return DEFAULT_CLICK_SCORING_CONFIG[clickCount]
    return toClickScoringAction(row.action)
  }
  return { 2: actionOf(2), 3: actionOf(3), 4: actionOf(4) }
}
