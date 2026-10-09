/**
 * ルーブリック項目の効き方を、項目の一覧に出す短い言葉にする（例: 「−1点」「誤答」「部分点 2点」）。
 */

import { SCORING_STATUS_LABELS } from "@/lib/scoringStatusColors"
import { isRubricSetStatus, type ScoringMethod } from "@/types/rubric.types"

import type { RubricScoringItem } from "../types"

/** 点の数を、符号付きで（減点は全角のマイナス） */
const signedPoints = (pointDelta: number) =>
  pointDelta > 0 ? `+${pointDelta}点` : `−${Math.abs(pointDelta)}点`

/** 項目の効き方の短い言葉 */
export function rubricEffectLabel(
  rubricItem: Pick<
    RubricScoringItem,
    "effectKind" | "pointDelta" | "setStatus" | "setScore"
  >
): string {
  if (rubricItem.effectKind === "adjust") {
    return rubricItem.pointDelta === null
      ? "加減"
      : signedPoints(rubricItem.pointDelta)
  }
  if (!isRubricSetStatus(rubricItem.setStatus)) return "判定"
  const statusLabel = SCORING_STATUS_LABELS[rubricItem.setStatus]
  return rubricItem.setScore === null
    ? statusLabel
    : `${statusLabel} ${rubricItem.setScore}点`
}

/** 採点方式の名前（画面の選択肢と見出し） */
export const SCORING_METHOD_LABELS: Record<ScoringMethod, string> = {
  points: "直接採点",
  deduction: "減点方式",
  addition: "加点方式",
}

/** 採点方式の説明（選択肢の下に添える） */
export const SCORING_METHOD_DESCRIPTIONS: Record<ScoringMethod, string> = {
  points: "採点キー・部分点で点を付けます（これまでどおり）",
  deduction: "配点から、当たった項目の減点を引きます",
  addition: "0点から、当たった項目の加点を足します",
}
