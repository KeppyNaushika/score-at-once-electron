/**
 * 類型評価と点の採点の間で方式を変えるときの、方式と合わない採点の数え方
 * （docs/vlm-grading-design.md §4-8-8「採点方式の切り替え」）。
 *
 * 方式を変えても採点の行は消さない・書き換えない。方式と合わない行（類型評価の設問の
 * 正答・誤答・部分点、点の採点の設問の評価済み）は得点にせず、方式を戻せば元の点に戻る。
 * 切り替える前に、その件数を示して確かめる。
 */

import type { ScoringMethod } from "@/types/rubric.types"

/** 類型評価の設問では得点にならない状態（正誤の評価） */
const POINT_VERDICT_STATUSES: ReadonlySet<string> = new Set([
  "correct",
  "incorrect",
  "partial",
])

/**
 * 点の採点の設問では得点にならない状態（類型を付けた評価済み）。
 * `evaluated` は S2 で `SCORING_STATUSES` に入る。それまでは行に現れないが、数え方は先に揃えておく
 */
const SCALE_VERDICT_STATUSES: ReadonlySet<string> = new Set(["evaluated"])

/** 類型評価と点の採点をまたぐ切り替えか（またがなければ採点行は方式と合ったまま） */
export const crossesScaleBoundary = (
  currentMethod: ScoringMethod,
  nextMethod: ScoringMethod
): boolean => (currentMethod === "scale") !== (nextMethod === "scale")

/** 方式を `nextMethod` にしたとき、方式と合わなくなる採点行の数 */
export function countIncompatibleScores(
  questionScores: readonly { status: string }[],
  nextMethod: ScoringMethod
): number {
  const incompatibleStatuses =
    nextMethod === "scale" ? POINT_VERDICT_STATUSES : SCALE_VERDICT_STATUSES
  return questionScores.filter((questionScore) =>
    incompatibleStatuses.has(questionScore.status)
  ).length
}
