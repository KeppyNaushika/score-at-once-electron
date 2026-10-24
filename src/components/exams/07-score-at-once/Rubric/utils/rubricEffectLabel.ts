/**
 * ルーブリック項目の効き方を、項目の一覧に出す短い言葉にする（例: 「−1点」「誤答」「部分点 2点」「類型 A」）。
 */

import { SCORING_STATUS_LABELS } from "@/lib/shared/scoringStatusLabels"
import {
  isRubricSetStatus,
  isStatusCompatibleWithScoringMethod,
  type ScoringMethod,
} from "@/types/rubric.types"

import type { RubricScoringItem } from "../types"

/** 効き方の言葉に要る項目の列 */
type RubricEffectSource = Pick<
  RubricScoringItem,
  "effectKind" | "pointDelta" | "setStatus" | "setScore" | "setScaleLevelId"
>

/** 類型にする項目の記号を引く類型（設問の類型表の類型。類型方式でなければ渡さない） */
type ScaleLevelForLabel = { id: string; label: string }

/** 点の数を、符号付きで（減点は全角のマイナス） */
const signedPoints = (pointDelta: number) =>
  pointDelta > 0 ? `+${pointDelta}点` : `−${Math.abs(pointDelta)}点`

/**
 * 項目の効き方の短い言葉。類型にする項目は「類型 A」（類型が消えた・ほかの組の類型なら「類型（なし）」）
 */
export function rubricEffectLabel(
  rubricItem: RubricEffectSource,
  scaleLevels: readonly ScaleLevelForLabel[] = []
): string {
  if (rubricItem.effectKind === "adjust") {
    return rubricItem.pointDelta === null
      ? "加減"
      : signedPoints(rubricItem.pointDelta)
  }
  if (!isRubricSetStatus(rubricItem.setStatus)) return "判定"
  if (rubricItem.setStatus === "evaluated") {
    const scaleLevel = scaleLevels.find(
      (candidate) => candidate.id === rubricItem.setScaleLevelId
    )
    return scaleLevel ? `類型 ${scaleLevel.label}` : "類型（なし）"
  }
  const statusLabel = SCORING_STATUS_LABELS[rubricItem.setStatus]
  return rubricItem.setScore === null
    ? statusLabel
    : `${statusLabel} ${rubricItem.setScore}点`
}

/** 項目の呼び名（判断理由が空なら効き方） */
export function rubricItemName(
  rubricItem: RubricEffectSource & { label: string },
  scaleLevels: readonly ScaleLevelForLabel[] = []
): string {
  return rubricItem.label || rubricEffectLabel(rubricItem, scaleLevels)
}

/**
 * 項目がその方式の設問で効くか。類型方式の設問の加減・正答などの項目と、ほかの設問の類型にする項目は
 * 効かない（方式を変える前に作った項目。採点と同じく行は残し、方式を戻せばまた効く。§4-8-8）
 */
export function isRubricItemEffective(
  scoringMethod: ScoringMethod,
  rubricItem: Pick<RubricScoringItem, "effectKind" | "setStatus">
): boolean {
  if (rubricItem.effectKind !== "set") return scoringMethod !== "scale"
  return (
    isRubricSetStatus(rubricItem.setStatus) &&
    isStatusCompatibleWithScoringMethod(scoringMethod, rubricItem.setStatus)
  )
}

/** 採点方式の名前（画面の選択肢と見出し） */
export const SCORING_METHOD_LABELS: Record<ScoringMethod, string> = {
  points: "正誤方式",
  deduction: "減点方式",
  addition: "加点方式",
  scale: "類型方式",
}

/** 採点方式の説明（選択肢の下に添える） */
export const SCORING_METHOD_DESCRIPTIONS: Record<ScoringMethod, string> = {
  points: "採点キー・部分点で点を付けます（これまでどおり）",
  deduction: "配点から、該当する項目の減点を引きます",
  addition: "0点から、該当する項目の加点を足します",
  scale: "A/B/C などの類型で評価し、点は類型ごとに決めた点数にします",
}
