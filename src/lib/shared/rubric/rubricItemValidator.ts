/**
 * ルーブリック項目の値の検証（docs/vlm-grading-design.md §6-4）。
 *
 * main が書く前に必ず通し、画面の入力欄も同じ規則で知らせられるよう共用の場所に置く。
 *
 * - `adjust` は `pointDelta` があり、`setStatus`・`setScore` は null
 * - `set` はその逆で、`setStatus` は correct / partial / incorrect / no_answer / pending
 * - 点の範囲と刻みは AI の判定と同じ規則（§6-1）: 0〜配点、0.01 単位。配点の無い設問では点を付けない
 *   - `setScore` は partial では必ずあり、pending では任意、それ以外では null。配点と同じ点の partial は correct にする
 *   - `pointDelta` は 0 でなく、絶対値が配点以下
 * - 類型方式の設問（§4-8-6）: 項目は `set` だけで、判定は evaluated（類型にする）・無答・保留。
 *   evaluated は設問が今使っている類型表の類型（`setScaleLevelId`）を必ず持つ。点（`setScore`）は付けない
 *   （点は類型の点数から読む）。類型方式でない設問では evaluated も類型も使えない
 */

import {
  isRubricEffectKind,
  isRubricSetStatus,
  isStatusCompatibleWithScoringMethod,
  type RubricEffectKind,
  type RubricSetStatus,
  toScoringMethod,
} from "@/types/rubric.types"

/** 検証する項目の効き方の値（DB の列と同じ名前） */
export interface RubricItemEffect {
  readonly effectKind: string
  readonly pointDelta: number | null
  readonly setStatus: string | null
  readonly setScore: number | null
  readonly setScaleLevelId: string | null
}

/** 検証が読む設問の値 */
export interface RubricItemEffectRegion {
  /** 設問の配点（CropRegion.points）。配点の無い設問は null */
  readonly points: number | null
  /** CropRegion.scoringMethod（DB の文字列のまま） */
  readonly scoringMethod: string
  /** 設問が今使っている類型表の類型の id（類型方式でない・組が無い設問は空） */
  readonly scaleLevelIds: readonly string[]
}

/** 検証を通った効き方。種類ごとに使う列だけが値を持つ */
export type ValidatedRubricItemEffect =
  | {
      readonly effectKind: Extract<RubricEffectKind, "adjust">
      readonly pointDelta: number
      readonly setStatus: null
      readonly setScore: null
      readonly setScaleLevelId: null
    }
  | {
      readonly effectKind: Extract<RubricEffectKind, "set">
      readonly pointDelta: null
      readonly setStatus: RubricSetStatus
      readonly setScore: number | null
      /** evaluated のときだけ値を持つ */
      readonly setScaleLevelId: string | null
    }

type RubricItemEffectValidation =
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

/** 類型方式の設問の項目を検証する（set だけ・判定は evaluated / 無答 / 保留・点なし） */
function validateScaleRubricItemEffect(
  effect: RubricItemEffect,
  scaleLevelIds: readonly string[]
): RubricItemEffectValidation {
  const reasons: string[] = []
  if (effect.effectKind !== "set") {
    return {
      ok: false,
      reasons: ["類型方式の設問では、点を加減する項目を作れません"],
    }
  }
  if (effect.pointDelta !== null) {
    reasons.push("判定を決める項目には加減する点を指定できません")
  }
  if (effect.setScore !== null) {
    reasons.push("類型方式の設問の項目には点を指定できません")
  }
  const setStatus = effect.setStatus
  if (
    setStatus === null ||
    !isRubricSetStatus(setStatus) ||
    !isStatusCompatibleWithScoringMethod("scale", setStatus)
  ) {
    reasons.push(
      `類型方式の設問では、判定「${setStatus ?? ""}」を決められません`
    )
    return { ok: false, reasons }
  }
  if (setStatus === "evaluated") {
    if (effect.setScaleLevelId === null) {
      reasons.push("類型にする項目には類型を選んでください")
    } else if (!scaleLevelIds.includes(effect.setScaleLevelId)) {
      reasons.push("この設問の類型表の類型ではありません")
    }
  } else if (effect.setScaleLevelId !== null) {
    reasons.push("無答・保留の項目には類型を指定できません")
  }
  if (reasons.length > 0) return { ok: false, reasons }
  return {
    ok: true,
    value: {
      effectKind: "set",
      pointDelta: null,
      setStatus,
      setScore: null,
      setScaleLevelId:
        setStatus === "evaluated" ? effect.setScaleLevelId : null,
    },
  }
}

/** 項目の効き方を、設問（配点・方式・類型）に照らして検証する */
export function validateRubricItemEffect(
  effect: RubricItemEffect,
  region: RubricItemEffectRegion
): RubricItemEffectValidation {
  const reasons: string[] = []
  const maxPoints = region.points

  if (!isRubricEffectKind(effect.effectKind)) {
    return {
      ok: false,
      reasons: [`項目の種類「${effect.effectKind}」は使えません`],
    }
  }

  const scoringMethod = toScoringMethod(region.scoringMethod)
  if (scoringMethod === "scale") {
    return validateScaleRubricItemEffect(effect, region.scaleLevelIds)
  }
  if (effect.setScaleLevelId !== null) {
    reasons.push("類型方式でない設問の項目には類型を指定できません")
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
        setScaleLevelId: null,
      },
    }
  }

  if (effect.pointDelta !== null) {
    reasons.push("判定を決める項目には加減する点を指定できません")
  }
  const setStatus = effect.setStatus
  if (
    setStatus === null ||
    !isRubricSetStatus(setStatus) ||
    !isStatusCompatibleWithScoringMethod(scoringMethod, setStatus)
  ) {
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
        reasons.push("配点と同じ部分点は、正答の項目にしてください")
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
      setScaleLevelId: null,
    },
  }
}
