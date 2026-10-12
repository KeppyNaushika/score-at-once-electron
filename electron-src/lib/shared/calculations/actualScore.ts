import type { CropRegion } from "@prisma/client"

import { assertNever } from "@/lib/assertNever"
import {
  isStatusCompatibleWithScoringMethod,
  toScoringMethod,
} from "@/types/rubric.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

/**
 * 採点ステータスから実際の得点を求める純粋関数。
 *
 * 採点・出力・成績算出の全経路が同じ規則で得点化するための単一実装。DB に触れないので
 * renderer からも import できる（`prisma/` 配下に置くと prisma を巻き込んで呼べなくなる）。
 */

/**
 * 実際の得点を計算する。
 *
 * 設問の方式と合わない採点（類型評価の設問の正答・誤答・部分点、点の採点の設問の評価済み）は
 * 得点にしない（null。欠測）。行は消さないので、方式を戻せば元の点に戻る（docs/vlm-grading-design.md §4-8-8）
 *
 * @param questionScore 採点データ（status と部分点。類型評価なら付けた類型）
 * @param cropRegion 設問（配点と方式）。CropRegion の行をそのまま渡せる
 * @returns 得点。未採点・部分点未入力・方式と合わない採点は null
 */
export const calculateActualScore = (
  questionScore: {
    status: ScoringStatus
    partialScore?: number | null
    /**
     * 類型評価で付けた類型（採点行の include で同梱した行）。類型が消えた（SetNull）・
     * 類型評価でない採点は null で、評価済みでも欠測になる
     */
    scaleLevel: { score: number } | null
  },
  cropRegion: Pick<CropRegion, "points" | "scoringMethod">
): number | null => {
  if (
    !isStatusCompatibleWithScoringMethod(
      toScoringMethod(cropRegion.scoringMethod),
      questionScore.status
    )
  ) {
    return null
  }
  switch (questionScore.status) {
    case "correct":
      return cropRegion.points ?? 0
    case "incorrect":
    case "no_answer":
    case "double_mark":
      return 0 // 誤答・無答・Wマークは 0/配点 と表示
    case "unscored":
      return null // 未採点は null を返して -/配点 と表示
    case "partial":
    case "pending":
      return questionScore.partialScore !== null &&
        questionScore.partialScore !== undefined
        ? Number(questionScore.partialScore)
        : null
    case "evaluated":
      // 類型の点数そのもの。配点を超えてよい（0〜配点に収めない）
      return questionScore.scaleLevel?.score ?? null
  }
  // **網羅していない値はここでコンパイルエラーになる。** `string` で受けていた頃は
  // `default: return 0` で黙って通り、未知の判定が「未採点（欠測）」ではなく
  // **0点として成績に算入されていた**。
  return assertNever(questionScore.status)
}
