/**
 * ルーブリック項目の値の検証（docs/vlm-grading-design.md §6-4）。
 *
 * main が書く前に必ず通し、画面の入力欄も同じ規則で知らせられるよう共用の場所に置く。
 *
 * - `adjust` は `pointDelta` があり、`setStatus`・`setScore` は null
 * - `set` はその逆で、`setStatus` は correct / partial / incorrect / no_answer / pending
 * - 点の範囲と刻みは AI の判定と同じ規則（§6-1）: 0〜配点、0.01 単位。配点の無い設問では点を付けない
 *   - `setScore` は partial では必ずあり、pending では任意、それ以外では null。満点の partial は correct にする
 *   - `pointDelta` は 0 でなく、絶対値が配点以下
 */

import {
  isRubricEffectKind,
  isRubricSetStatus,
  type RubricEffectKind,
  type RubricSetStatus,
} from "@/types/rubric.types"

/** 検証する項目の効き方の値（DB の列と同じ名前） */
export interface RubricItemEffect {
  readonly effectKind: string
  readonly pointDelta: number | null
  readonly setStatus: string | null
  readonly setScore: number | null
}

/** 検証を通った効き方。種類ごとに使う列だけが値を持つ */
export type ValidatedRubricItemEffect =
  | {
      readonly effectKind: Extract<RubricEffectKind, "adjust">
      readonly pointDelta: number
      readonly setStatus: null
      readonly setScore: null
    }
  | {
      readonly effectKind: Extract<RubricEffectKind, "set">
      readonly pointDelta: null
      readonly setStatus: RubricSetStatus
      readonly setScore: number | null
    }

export type RubricItemEffectValidation =
  | { readonly ok: true; readonly value: ValidatedRubricItemEffect }
  | { readonly ok: false; readonly reasons: readonly string[] }

/** 浮動小数の誤差（0.1 + 0.2 など）を、0.01 より細かい点と取り違えないための許容幅 */
const CENT_EPSILON = 1e-9

const hasFinerThanCent = (score: number): boolean =>
  Math.abs(score * 100 - Math.round(score * 100)) > CENT_EPSILON

const roundToCent = (score: number): number => Math.round(score * 100) / 100

/** 点の刻みと範囲（0〜上限）を確かめ、外れた理由を足す */
function checkScoreRange(
  score: number,
  upperBound: number,
  subject: string,
  reasons: string[]
): void {
  if (!Number.isFinite(score)) {
    reasons.push(`${subject}が数ではありません`)
    return
  }
  if (hasFinerThanCent(score)) {
    reasons.push(`${subject}は 0.01 点単位で指定してください`)
  }
  if (score < 0 || score > upperBound) {
    reasons.push(`${subject}は 0〜${upperBound} 点の範囲で指定してください`)
  }
}

/**
 * 項目の効き方を検証する。
 *
 * @param maxPoints 設問の配点（CropRegion.points）。配点の無い設問は null
 */
export function validateRubricItemEffect(
  effect: RubricItemEffect,
  maxPoints: number | null
): RubricItemEffectValidation {
  const reasons: string[] = []

  if (!isRubricEffectKind(effect.effectKind)) {
    return {
      ok: false,
      reasons: [`項目の種類「${effect.effectKind}」は使えません`],
    }
  }

  if (effect.effectKind === "adjust") {
    if (effect.setStatus !== null || effect.setScore !== null) {
      reasons.push("点を加減する項目には判定と点を指定できません")
    }
    if (maxPoints === null) {
      reasons.push("配点の無い設問では点を加減する項目を作れません")
    }
    const pointDelta = effect.pointDelta
    if (pointDelta === null) {
      reasons.push("加減する点を指定してください")
    } else if (pointDelta === 0) {
      reasons.push("加減する点に 0 は指定できません")
    } else if (maxPoints !== null) {
      checkScoreRange(Math.abs(pointDelta), maxPoints, "加減する点", reasons)
    }
    if (reasons.length > 0 || pointDelta === null) return { ok: false, reasons }
    return {
      ok: true,
      value: {
        effectKind: "adjust",
        pointDelta: roundToCent(pointDelta),
        setStatus: null,
        setScore: null,
      },
    }
  }

  if (effect.pointDelta !== null) {
    reasons.push("判定を決める項目には加減する点を指定できません")
  }
  const setStatus = effect.setStatus
  if (setStatus === null || !isRubricSetStatus(setStatus)) {
    reasons.push(`判定「${setStatus ?? ""}」は項目で決められません`)
    return { ok: false, reasons }
  }
  const setScore = effect.setScore
  if (setStatus === "partial" && setScore === null) {
    reasons.push("部分点の項目には点を指定してください")
  }
  if (setStatus !== "partial" && setStatus !== "pending" && setScore !== null) {
    reasons.push("部分点・保留でない項目には点を指定できません")
  }
  if (setScore !== null) {
    if (maxPoints === null) {
      reasons.push("配点の無い設問では点を指定できません")
    } else {
      checkScoreRange(setScore, maxPoints, "点", reasons)
      if (setStatus === "partial" && setScore === maxPoints) {
        reasons.push("満点の部分点は、正答の項目にしてください")
      }
    }
  }
  if (reasons.length > 0) return { ok: false, reasons }
  return {
    ok: true,
    value: {
      effectKind: "set",
      pointDelta: null,
      setStatus,
      setScore: setScore === null ? null : roundToCent(setScore),
    },
  }
}
