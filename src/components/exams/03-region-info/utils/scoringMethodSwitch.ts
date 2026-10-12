/**
 * 類型評価と点の採点の間で方式を変えるときの、方式と合わない採点の数え方
 * （docs/vlm-grading-design.md §4-8-8「採点方式の切り替え」）。
 *
 * 方式を変えても採点の行は消さない・書き換えない。方式と合わない行（類型評価の設問の
 * 正答・誤答・部分点、点の採点の設問の評価済み）は未採点として扱い（採点済みにも数えず、
 * 画面にも出力にも出さない）、方式を戻せば元の採点に戻る。
 * 切り替える前に、その件数を示して確かめる。
 */

import {
  isStatusCompatibleWithScoringMethod,
  type ScoringMethod,
} from "@/types/rubric.types"

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
  return questionScores.filter(
    (questionScore) =>
      !isStatusCompatibleWithScoringMethod(nextMethod, questionScore.status)
  ).length
}
