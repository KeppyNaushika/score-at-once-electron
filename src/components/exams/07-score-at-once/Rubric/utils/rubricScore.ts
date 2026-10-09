/**
 * ルーブリック項目の適用から1マスの点を計算する（docs/vlm-grading-design.md §4-4）。
 *
 * 1. 手での上書き（`overridesRubric`）があれば計算しない
 * 2. `set` の項目が当たっていれば、その判定と点を採る。複数当たっていれば並び順
 *    （`sortOrder` → 作成日時 → id）が先のものを採り、採らなかったものを返す（画面で知らせる）
 * 3. 無ければ、減点方式は 配点 + Σ`pointDelta`、加点方式は 0 + Σ`pointDelta` を、0〜配点に収める
 * 4. 満点は `correct`、0点は `incorrect`、その間は `partial`。適用が1つも無い答案は `unscored`
 *    （減点方式でも、項目を当てていない答案を満点にはしない）
 *
 * 採点方式が `points`（直接採点）の設問では計算しない。配点の無い設問では点を付けない
 * （`set` の判定だけを採り、加減だけのマスは `unscored`）。
 *
 * 同じ項目の適用が2つあっても（同期で重なった行）、1つとして数える。設問の項目に無い
 * 適用（消えた項目を指すもの）は数えない。
 */

import { isRubricSetStatus, toScoringMethod } from "@/types/rubric.types"

import type {
  RubricScoredRow,
  RubricScoreResult,
  RubricScoringItem,
  RubricScoringRegion,
} from "../types"

export type RubricScoreOutcome =
  /** 採点方式が points（採点キー・部分点で直接付ける）。項目から点を決めない */
  | { kind: "directScoring" }
  /** 採点キーで付けた点が項目より優先している。計算し直しはこの行を飛ばす */
  | { kind: "overridden" }
  | {
      kind: "computed"
      result: RubricScoreResult
      /** 判定を決めた set の項目。set が当たっていなければ null */
      decidingSetItemId: string | null
      /** 当たっていたが採らなかった set の項目（並び順で後のもの） */
      shadowedSetItemIds: string[]
    }

const UNSCORED: RubricScoreResult = { status: "unscored", partialScore: null }

const roundToCent = (score: number): number => Math.round(score * 100) / 100

/** set の項目の並び順（sortOrder → 作成日時 → id）。入力の並びに左右されないように */
const compareSetPriority = (
  left: RubricScoringItem,
  right: RubricScoringItem
): number =>
  left.sortOrder - right.sortOrder ||
  left.createdAt.getTime() - right.createdAt.getTime() ||
  left.id.localeCompare(right.id)

/** 0〜配点に収めた点から、判定と点を決める */
function resultFromTotal(total: number, points: number): RubricScoreResult {
  const clamped = roundToCent(Math.min(Math.max(total, 0), points))
  if (clamped >= points) return { status: "correct", partialScore: null }
  if (clamped <= 0) return { status: "incorrect", partialScore: null }
  return { status: "partial", partialScore: clamped }
}

/** set の項目が決める判定と点。部分点・保留だけが点を持つ */
function resultFromSetItem(
  item: RubricScoringItem,
  points: number | null
): RubricScoreResult {
  if (!isRubricSetStatus(item.setStatus)) return UNSCORED
  const keepsScore =
    item.setStatus === "partial" || item.setStatus === "pending"
  const score =
    keepsScore && item.setScore !== null && points !== null
      ? roundToCent(Math.min(Math.max(item.setScore, 0), points))
      : null
  // 点の無い部分点は作れない（配点が消えた・項目の点が消えた）。保留に倒す
  if (item.setStatus === "partial" && score === null) {
    return { status: "pending", partialScore: null }
  }
  return { status: item.setStatus, partialScore: score }
}

/** 1マスの点を計算する */
export function computeRubricScore(
  region: RubricScoringRegion,
  rubricItems: readonly RubricScoringItem[],
  row: Pick<RubricScoredRow, "overridesRubric" | "rubricApplications">
): RubricScoreOutcome {
  const scoringMethod = toScoringMethod(region.scoringMethod)
  if (scoringMethod === "points") return { kind: "directScoring" }
  if (row.overridesRubric) return { kind: "overridden" }

  const appliedItemIds = new Set(
    row.rubricApplications.map((application) => application.rubricItemId)
  )
  const appliedItems = rubricItems.filter((rubricItem) =>
    appliedItemIds.has(rubricItem.id)
  )
  if (appliedItems.length === 0) {
    return {
      kind: "computed",
      result: UNSCORED,
      decidingSetItemId: null,
      shadowedSetItemIds: [],
    }
  }

  const setItems = appliedItems
    .filter((rubricItem) => rubricItem.effectKind === "set")
    .sort(compareSetPriority)
  if (setItems.length > 0) {
    const [decidingItem, ...shadowedItems] = setItems
    return {
      kind: "computed",
      result: resultFromSetItem(decidingItem, region.points),
      decidingSetItemId: decidingItem.id,
      shadowedSetItemIds: shadowedItems.map((rubricItem) => rubricItem.id),
    }
  }

  const adjustTotal = appliedItems
    .filter((rubricItem) => rubricItem.effectKind === "adjust")
    .reduce((acc, rubricItem) => acc + (rubricItem.pointDelta ?? 0), 0)
  const result =
    region.points === null
      ? UNSCORED
      : resultFromTotal(
          (scoringMethod === "deduction" ? region.points : 0) + adjustTotal,
          region.points
        )
  return {
    kind: "computed",
    result,
    decidingSetItemId: null,
    shadowedSetItemIds: [],
  }
}

/** 保存されている点と計算した点が同じか（部分点は 0.01 単位で比べる） */
export function isSameRubricScore(
  left: RubricScoreResult,
  right: RubricScoreResult
): boolean {
  if (left.status !== right.status) return false
  if (left.partialScore === null || right.partialScore === null) {
    return left.partialScore === right.partialScore
  }
  return roundToCent(left.partialScore) === roundToCent(right.partialScore)
}
