/**
 * 配点の欄の読み取りと、配点を変えたときの点の計算し直し（docs/vlm-grading-design.md §4-4・§4-6）。
 *
 * 減点・加点方式の設問は、配点が点の計算に入る（減点方式は 配点 + Σ減点、どちらも 0〜配点に収める）。
 * 配点を変えると当たっている答案の点が変わり、項目は共有なので他の採点者の点も変わる。
 * 配点は1打鍵ごとに書くので、計算し直しも1打鍵ごとに、その打鍵の配点で行う。
 */

import type { RubricRecalculationSource } from "@/components/exams/07-score-at-once/Rubric/utils/rubricRecalculation"
import { planRubricRecalculation } from "@/components/exams/07-score-at-once/Rubric/utils/rubricRecalculation"
import {
  computesScoreFromRubricItems,
  toScoringMethod,
} from "@/types/rubric.types"

/** 配点の欄に打った文字の読み */
type PointsInput =
  /** 書ける配点。空欄は未設定（null） */
  | { kind: "points"; points: number | null }
  /** 数にできない途中（`-` など）。書かない */
  | { kind: "incomplete" }

/** 配点が点の計算に入る設問か（減点・加点方式） */
export const recalculatesRubricScores = (scoringMethod: string): boolean =>
  computesScoreFromRubricItems(toScoringMethod(scoringMethod))

/**
 * 配点の欄の文字を読む。
 *
 * 直接採点の設問では、空欄は「未設定」（null）として書く（これまでどおり）。
 * 減点・加点方式の設問では、空欄も書かない。打ち直しで一度消しただけで、
 * 全採点者の点を配点なしで計算し直してしまうため
 */
export function readPointsInput(
  text: string,
  scoringMethod: string
): PointsInput {
  if (text === "") {
    return recalculatesRubricScores(scoringMethod)
      ? { kind: "incomplete" }
      : { kind: "points", points: null }
  }
  const points = parseFloat(text)
  return Number.isNaN(points)
    ? { kind: "incomplete" }
    : { kind: "points", points }
}

/**
 * 配点を変えたあとの、点の変わる行（全採点者。手での上書きの行は飛ばす）。
 * 材料が無い（設問が消えた）ときは対象なし
 */
export const planPointsRecalculation = (
  source: RubricRecalculationSource | null,
  nextPoints: number | null
) => (source ? planRubricRecalculation({ ...source, points: nextPoints }) : [])
