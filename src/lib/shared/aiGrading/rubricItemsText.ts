/**
 * ルーブリック項目の一覧を、AI へ送る文にする（docs/vlm-grading-design.md §3-1・§3-3・§3-4）
 *
 * 1段目（答案ごと）と2段目（全員分）の両方に同じ書き方で載せる。送った時点の一覧を
 * プロンプトの行（`renderedRubricItems`）へ写すときも、この文をそのまま使う。
 *
 * 項目の id は uuid なので送ってよい（生徒の情報を含まない）。並びは呼び出し側が渡した順
 * （`sortOrder` の順）のまま変えない。同じ入力からは同じ文になる。
 */

import type { AiGradingOutputStatus } from "./gradingSchema"

/** 項目の種類。adjust は点の加減、set は判定と点を決める（設計 §4-2） */
export const RUBRIC_EFFECT_KINDS = ["adjust", "set"] as const
export type RubricEffectKind = (typeof RUBRIC_EFFECT_KINDS)[number]

/** 送る文に要る、ルーブリック項目の値 */
export interface RubricItemForPrompt {
  readonly id: string
  readonly label: string
  readonly effectKind: RubricEffectKind
  /** adjust のときの加減（減点は負） */
  readonly pointDelta: number | null
  /** set のときの判定 */
  readonly setStatus: AiGradingOutputStatus | null
  /** set のときの点（partial・pending のときだけ） */
  readonly setScore: number | null
}

/** 判定の日本語の呼び名（プロンプトの中で使う） */
export const OUTPUT_STATUS_LABELS: Readonly<
  Record<AiGradingOutputStatus, string>
> = {
  correct: "正答",
  partial: "部分点",
  incorrect: "誤答",
  no_answer: "無答",
  pending: "保留",
}

/** 点の加減を符号つきで書く（+1点 / −0.5点） */
function formatPointDelta(pointDelta: number): string {
  return pointDelta < 0 ? `−${Math.abs(pointDelta)}点` : `+${pointDelta}点`
}

/** 項目の効き目を1語で書く */
function formatEffect(rubricItem: RubricItemForPrompt): string {
  if (rubricItem.effectKind === "adjust") {
    return rubricItem.pointDelta === null
      ? "加減（点なし）"
      : formatPointDelta(rubricItem.pointDelta)
  }
  if (rubricItem.setStatus === null) return "判定（未設定）"
  const statusLabel = OUTPUT_STATUS_LABELS[rubricItem.setStatus]
  return rubricItem.setScore === null
    ? `判定を${statusLabel}にする`
    : `判定を${statusLabel}（${rubricItem.setScore}点）にする`
}

/**
 * 項目の一覧の節。項目が無ければ null（節ごと省く）。
 * 1行1項目で「id・効き目・名前」を並べる
 */
export function formatRubricItemsSection(
  rubricItems: readonly RubricItemForPrompt[]
): string | null {
  if (rubricItems.length === 0) return null
  const lines = rubricItems.map(
    (rubricItem) =>
      `- id: ${rubricItem.id} ／ ${formatEffect(rubricItem)} ／ ${rubricItem.label.trim()}`
  )
  return ["## ルーブリック項目", ...lines].join("\n")
}
