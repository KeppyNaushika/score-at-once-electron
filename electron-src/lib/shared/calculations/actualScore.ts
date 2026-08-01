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
  questionScore: { status: string; partialScore?: number | null },
  maxScore: number
): number | null => {
  switch (questionScore.status) {
    case "correct":
      return maxScore
    case "final":
      // 廃止済みstatus。未変換の旧データへの耐性として残す
      // （確定値は partialScore、満点確定時は null のことがある）
      return questionScore.partialScore !== null &&
        questionScore.partialScore !== undefined
        ? Number(questionScore.partialScore)
        : maxScore
    case "incorrect":
    case "no_answer":
    case "double_mark":
      return 0 // 誤答・無答・Wマークは 0/配点 と表示
    case "unscored":
      return null // 未採点は null を返して -/配点 と表示
    case "partial":
    case "pending":
    case "proposed": // 廃止済みstatus（旧データ耐性）
      return questionScore.partialScore !== null &&
        questionScore.partialScore !== undefined
        ? Number(questionScore.partialScore)
        : null
    default:
      return 0
  }
}
