/**
 * 類型方式の設問の類型の一覧を、AI へ送る文にする（docs/vlm-grading-design.md §4-8-6）
 *
 * 1段目（答案ごと）と2段目（全員分）の両方に同じ書き方で載せる。送った時点の一覧を
 * 採点指示の行（`renderedScaleLevels`）へ写すときも、この文をそのまま使う。
 * 採点項目の一覧（`rubricItemsText.ts`）と同じく、類型は id（uuid）で識別させる。
 *
 * 類型の点数は送らない。類型が評価そのもので、点は教員が類型ごとに決めた点数から導くため
 * （点を見せると、AI が点で選ぶようになる）。並びは呼び出し側が渡した順（`sortOrder` の順）のまま
 * 変えない。同じ入力からは同じ文になる。
 */

import type { ScoreScaleLevel } from "@prisma/client"

/** 送る類型の値（記号・説明と、選ばせる id） */
export type ScaleLevelForPrompt = Readonly<
  Pick<ScoreScaleLevel, "id" | "label" | "description">
>

/** 類型の記号。空なら「（記号なし）」にする */
export function scaleLevelLabelText(
  scaleLevel: Pick<ScaleLevelForPrompt, "label">
): string {
  const label = scaleLevel.label.trim()
  return label === "" ? "（記号なし）" : label
}

/**
 * 類型の一覧の節。類型が無ければ null（節ごと省く。類型方式でない設問）。
 * 1行1類型で「id・記号・説明」を並べる
 */
export function formatScaleLevelsSection(
  scaleLevels: readonly ScaleLevelForPrompt[]
): string | null {
  if (scaleLevels.length === 0) return null
  const lines = scaleLevels.map((scaleLevel) => {
    const description = scaleLevel.description.trim()
    return `- id: ${scaleLevel.id} ／ ${scaleLevelLabelText(scaleLevel)} ／ ${description === "" ? "（説明なし）" : description}`
  })
  return [
    "## 類型",
    "この設問は類型方式です。正答・誤答・部分点は付けず、教員が定めた次の類型（記号と説明）のうち、答案に当てはまるものを id で選びます。",
    ...lines,
  ].join("\n")
}

/** 類型の行の頭（`- id: <uuid> ／`）。送った文から id を読み戻すのに使う */
const SCALE_LEVEL_LINE_PATTERN = /^- id: ([0-9a-f-]{36}) ／ /gm

/**
 * 送った類型の一覧の文（`AiPrompt.renderedScaleLevels`）から、類型の id を送った順に読み戻す。
 *
 * バッチの結果は送ってから時間を置いて届くので、1段目の類型を検証するときは、
 * そのときの設問の類型ではなく、送った一覧に載っていた id と照らす。
 * 空の文（類型方式でない設問）からは空の配列を返す
 */
export function parseScaleLevelIds(renderedScaleLevels: string): string[] {
  return [...renderedScaleLevels.matchAll(SCALE_LEVEL_LINE_PATTERN)].map(
    (match) => match[1]
  )
}
