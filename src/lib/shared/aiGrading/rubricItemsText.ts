/**
 * 採点項目の一覧を、AI へ送る文にする（docs/vlm-grading-design.md §3-1・§3-3・§3-4）
 *
 * 1段目（答案ごと）と2段目（全員分）の両方に同じ書き方で載せる。送った時点の一覧を
 * 採点指示の行（`renderedRubricItems`）へ写すときも、この文をそのまま使う。
 *
 * 項目の id は uuid なので送ってよい（生徒の情報を含まない）。並びは呼び出し側が渡した順
 * （`sortOrder` の順）のまま変えない。同じ入力からは同じ文になる。
 */

import {
  isRubricSetStatus,
  type RubricItemForPrompt,
  toRubricEffectKind,
} from "@/types/rubric.types"

import type { AiGradingOutputStatus } from "./gradingSchema"
import {
  type ScaleLevelForPrompt,
  scaleLevelLabelText,
} from "./scaleLevelsText"

/** 項目の行（境界を越えたもの、または main で Decimal を数にしたもの）から、送る値へ */
export function toRubricItemForPrompt(rubricItem: {
  id: string
  label: string
  effectKind: string
  pointDelta: number | null
  setStatus: string | null
  setScore: number | null
  setScaleLevelId: string | null
}): RubricItemForPrompt {
  return {
    id: rubricItem.id,
    label: rubricItem.label,
    effectKind: toRubricEffectKind(rubricItem.effectKind),
    pointDelta: rubricItem.pointDelta,
    setStatus:
      rubricItem.setStatus !== null && isRubricSetStatus(rubricItem.setStatus)
        ? rubricItem.setStatus
        : null,
    setScore: rubricItem.setScore,
    setScaleLevelId: rubricItem.setScaleLevelId,
  }
}

/** 判定の日本語の呼び名（採点指示の中で使う） */
export const OUTPUT_STATUS_LABELS: Readonly<
  Record<AiGradingOutputStatus, string>
> = {
  correct: "正答",
  partial: "部分点",
  incorrect: "誤答",
  no_answer: "無答",
  pending: "保留",
  evaluated: "類型採点済み",
}

/** 点の加減を符号つきで書く（+1点 / −0.5点） */
function formatPointDelta(pointDelta: number): string {
  return pointDelta < 0 ? `−${Math.abs(pointDelta)}点` : `+${pointDelta}点`
}

/** 項目の効き目を1語で書く。類型にする項目は、送る類型の一覧から記号を引く */
function formatEffect(
  rubricItem: RubricItemForPrompt,
  scaleLevels: readonly ScaleLevelForPrompt[]
): string {
  if (rubricItem.effectKind === "adjust") {
    return rubricItem.pointDelta === null
      ? "加減（点なし）"
      : formatPointDelta(rubricItem.pointDelta)
  }
  if (rubricItem.setStatus === null) return "判定（未設定）"
  if (rubricItem.setStatus === "evaluated") {
    const scaleLevel = scaleLevels.find(
      (candidate) => candidate.id === rubricItem.setScaleLevelId
    )
    return scaleLevel
      ? `類型を${scaleLevelLabelText(scaleLevel)}にする`
      : "類型（未設定）"
  }
  const statusLabel = OUTPUT_STATUS_LABELS[rubricItem.setStatus]
  return rubricItem.setScore === null
    ? `判定を${statusLabel}にする`
    : `判定を${statusLabel}（${rubricItem.setScore}点）にする`
}

/**
 * 項目の一覧の節。項目が無ければ null（節ごと省く）。
 * 1行1項目で「id・効き目・名前」を並べる。類型方式の設問では、類型にする項目の効き目に
 * 類型の記号を書くので、送る類型の一覧（`scaleLevels`）を渡す（ほかの設問は空）
 */
export function formatRubricItemsSection(
  rubricItems: readonly RubricItemForPrompt[],
  scaleLevels: readonly ScaleLevelForPrompt[] = []
): string | null {
  if (rubricItems.length === 0) return null
  const lines = rubricItems.map(
    (rubricItem) =>
      `- id: ${rubricItem.id} ／ ${formatEffect(rubricItem, scaleLevels)} ／ ${rubricItem.label.trim()}`
  )
  return [
    "## 採点項目",
    scaleLevels.length > 0
      ? "教員が定めた、類型を決める根拠の項目です。"
      : "教員が定めた、点を動かす基準の項目です。",
    ...lines,
  ].join("\n")
}

/** 項目の行の頭（`- id: <uuid> ／`）。送った文から id を読み戻すのに使う */
const RUBRIC_ITEM_LINE_PATTERN = /^- id: ([0-9a-f-]{36}) ／ /gm

/**
 * 送った項目の一覧の文（`AiPrompt.renderedRubricItems`）から、項目の id を送った順に読み戻す。
 *
 * バッチの結果は送ってから時間を置いて届くので、1段目の当てはまりを検証するときは、
 * そのとき生きている項目ではなく、送った一覧に載っていた id と照らす
 */
export function parseRubricItemIds(renderedRubricItems: string): string[] {
  return [...renderedRubricItems.matchAll(RUBRIC_ITEM_LINE_PATTERN)].map(
    (match) => match[1]
  )
}
