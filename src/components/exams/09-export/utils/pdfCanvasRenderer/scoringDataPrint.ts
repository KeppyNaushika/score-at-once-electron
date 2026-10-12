/**
 * 設問1つについて、答案に何を印刷するか（採点マークの画像・類型の記号・点数）を決める
 *
 * 描画（Canvas）から切り離した判定だけを置く。07 の個別表示と同じ規則にする
 * （類型評価は ○×△ の代わりに類型の記号を、点数として類型の点数を印刷する。
 *  docs/vlm-grading-design.md §4-8-5）
 */

import { isStatusCompatibleWithScoringMethod } from "@/types/rubric.types"

import type { ScoringDataForPdf } from "./types"

/**
 * 採点マーク画像のキー（`preloadScoringMarkImages` が読んだ画像の名前）。
 * 無答・Wマークは誤答の画像を使う。評価済みは画像を持たない（記号を文字で印刷する）
 */
export function markImageKeyOf(scoringData: ScoringDataForPdf): string | null {
  switch (scoringData.status) {
    case "no_answer":
    case "double_mark":
      return "incorrect"
    case "evaluated":
      return null
    default:
      return scoringData.status
  }
}

/**
 * 採点マークの代わりに印刷する類型の記号。方式と合う評価済みで類型が残っているときだけ
 * （main が方式と合うときだけ `scaleLevel` を載せる）
 */
export function scaleLevelLabelOf(
  scoringData: ScoringDataForPdf
): string | null {
  return scoringData.status === "evaluated" && scoringData.scaleLevel
    ? scoringData.scaleLevel.label
    : null
}

/**
 * 点数として印刷する数。印刷しないものは null。
 *
 * 方式と合わない採点（類型評価の設問の正答・誤答・部分点、点の採点の設問の評価済み）は
 * 得点にしないので印刷しない（§4-8-8）。それ以外の状態の扱いは従来どおり
 * （保留は点数を印刷しない）
 */
export function scoreToDisplayOf(
  scoringData: ScoringDataForPdf
): number | null {
  if (
    !isStatusCompatibleWithScoringMethod(
      scoringData.cropRegion.scoringMethod,
      scoringData.status
    )
  ) {
    return null
  }
  switch (scoringData.status) {
    case "correct":
      // 正解: 配点を表示
      return scoringData.cropRegion.maxScore ?? null
    case "partial":
      // 部分点: 部分点を表示
      return scoringData.partialScore ?? null
    case "incorrect":
    case "no_answer":
    case "double_mark":
      // 誤答/無答/Wマーク: 0点を表示
      return 0
    case "evaluated":
      // 類型評価: 類型の点数を表示（類型が消えていれば印刷しない）
      return scoringData.scaleLevel?.score ?? null
    default:
      return null
  }
}
