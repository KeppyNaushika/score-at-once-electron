import { assertNever } from "@/lib/assertNever"
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
 * @param questionScore 採点データ（status と部分点）
 * @param maxScore 配点
 * @returns 得点。未採点・部分点未入力は null
 */
export const calculateActualScore = (
  questionScore: {
    status: ScoringStatus
    partialScore?: number | null
  },
  maxScore: number
): number | null => {
  switch (questionScore.status) {
    case "correct":
      return maxScore
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
  }
  // **網羅していない値はここでコンパイルエラーになる。** `string` で受けていた頃は
  // `default: return 0` で黙って通り、未知の判定が「未採点（欠測）」ではなく
  // **0点として成績に算入されていた**（docs/branch-review-findings.md #16）。
  return assertNever(questionScore.status)
}
