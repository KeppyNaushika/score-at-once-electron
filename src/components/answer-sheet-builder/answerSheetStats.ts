import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"

/**
 * 解答用紙から設問数と合計配点を集計する。
 *
 * 枝問の扱い:
 * - 枝問なし: 小問を1問として数え、小問の配点を加算
 * - 枝問あり・完答モード（usesBranchPoints === false）: 小問を1問として数え、小問の配点を加算
 * - 枝問あり・枝問別配点: 各枝問を1問として数え、枝問の配点を合計
 *
 * 一覧列（サーバ側 listAsbDefinitions）と概要ページ・エディタで同じ規則を使うための単一の実装。
 */
export function countAsbQuestions(
  majorQuestions: AnswerSheetDefinition["majorQuestions"]
): { questionCount: number; totalPoints: number } {
  let questionCount = 0
  let totalPoints = 0
  for (const majorQuestion of majorQuestions) {
    for (const subQuestion of majorQuestion.subQuestions) {
      if (subQuestion.branchQuestions.length > 0) {
        if (subQuestion.usesBranchPoints === false) {
          questionCount += 1
          totalPoints += subQuestion.points
        } else {
          questionCount += subQuestion.branchQuestions.length
          totalPoints += subQuestion.branchQuestions.reduce(
            (sum, branchQuestion) => sum + branchQuestion.points,
            0
          )
        }
      } else {
        questionCount += 1
        totalPoints += subQuestion.points
      }
    }
  }
  return { questionCount, totalPoints }
}
