import type {
  AnswerSheet,
  QuestionRegion,
} from "@/components/projects/07-score-at-once/hooks/scoring-data/types/scoring-data-types"
import type {
  QuestionProgress,
  ScoringDataRecord,
} from "@/components/projects/07-score-at-once/hooks/scoring-data/types/scoring-data-types"

/**
 * 設問別進捗を計算する関数
 */
export function calculateQuestionProgress(
  questionRegions: QuestionRegion[],
  answerSheets: AnswerSheet[],
  scoringData: ScoringDataRecord
): QuestionProgress {
  const progress: QuestionProgress = {}

  questionRegions.forEach((question) => {
    // このCropRegionが属するProjectPageのページ番号を取得
    const questionPageNumber = question.projectPageId
      ? (question as any).projectPage?.pageNumber
      : undefined

    // 同じページ番号のAnswerSheetのみを対象とする
    const relevantAnswerSheets = answerSheets.filter(
      (sheet) => sheet.pageNumber === questionPageNumber,
    )

    const totalAnswers = relevantAnswerSheets.length
    let gradedAnswers = 0

    relevantAnswerSheets.forEach((sheet) => {
      const key = `${sheet.studentId}-${question.id}`
      const scoreData = scoringData[key]

      // 採点済みの状態をチェック（unscoredでない場合は採点済み）
      if (scoreData && scoreData.status !== "unscored") {
        gradedAnswers++
      }
    })

    const percentage =
      totalAnswers > 0 ? Math.round((gradedAnswers / totalAnswers) * 100) : 0

    progress[question.id] = {
      totalAnswers,
      gradedAnswers,
      percentage,
    }
  })

  return progress
}