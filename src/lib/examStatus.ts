/**
 * 試験ステータス判定の共通ユーティリティ
 *
 * 試験一覧と詳細ページで統一されたステータス判定を提供
 */

import { ExamWithDetails } from "@/types/common.types"

// 詳細な試験進捗情報
export interface ExamProgress {
  hasImages: boolean
  hasLayout: boolean
  hasRegionInfo: boolean
  hasSubtotalRegions: boolean
  hasSubtotalGroupSetting: boolean
  hasStudents: boolean
  hasAnswers: boolean
  hasScoring: boolean
  expectedScoringCount: number
  actualScoringCount: number
  questionAnswerCount: number
  answerSheetCount: number
}

/**
 * 試験の詳細進捗情報を計算
 */
export function getExamProgress(exam: ExamWithDetails): ExamProgress {
  // ExamWithDetails型を信頼し、基本的な存在チェックのみ実施
  if (!exam) {
    return {
      hasImages: false,
      hasLayout: false,
      hasRegionInfo: false,
      hasSubtotalRegions: false,
      hasSubtotalGroupSetting: false,
      hasStudents: false,
      hasAnswers: false,
      hasScoring: false,
      expectedScoringCount: 0,
      actualScoringCount: 0,
      questionAnswerCount: 0,
      answerSheetCount: 0,
    }
  }

  const hasImages = !!(exam.examPages && exam.examPages.length > 0)
  const hasLayout = !!(exam.cropRegions && exam.cropRegions.length > 0)
  const hasRegionInfo = hasLayout // 領域情報は領域が存在すれば設定済みとみなす

  // 小計点領域が存在するかチェック
  const hasSubtotalRegions =
    exam.cropRegions?.some((region) => region.type === "SUBTOTAL_SCORE") ||
    false

  // 小計点設定が完了しているかチェック（小計点領域がある場合のみ）
  const hasSubtotalGroupSetting = !!(
    !hasSubtotalRegions ||
    (exam.examSubtotalGroups && exam.examSubtotalGroups.length > 0)
  )

  const hasStudents = !!(exam.examStudents && exam.examStudents.length > 0)
  const hasAnswers = !!(exam.answerImages && exam.answerImages.length > 0)

  // 採点完了の精密な判定
  // QUESTION_ANSWER領域数 × 答案数 = 全採点すべき数
  const questionAnswerCount =
    exam.cropRegions?.filter((region) => region.type === "QUESTION_ANSWER")
      .length || 0

  // 受験・見込み生徒のIDリストを取得（欠席生徒を除外）
  const participatingStudentIds =
    exam.examStudents
      ?.filter(
        (examStudent) =>
          examStudent.status === "PARTICIPATING" ||
          examStudent.status === "EXPECTED"
      )
      ?.map((examStudent) => examStudent.studentId) || []

  // 受験・見込み生徒の数をカウント（複数ページの答案でも1人1回のみ）
  const answerSheetCount = new Set(
    exam.answerImages
      ?.filter(
        (img) =>
          img.studentId && participatingStudentIds.includes(img.studentId)
      )
      ?.map((img) => img.studentId)
  ).size

  const expectedScoringCount = questionAnswerCount * answerSheetCount

  // unscored以外のquestionScoresの個数を取得
  // 受験・見込み生徒のQuestionScoreのみをカウント（欠席生徒を除外）
  const actualScoringCount =
    exam.cropRegions?.reduce((total, region) => {
      if (region.type === "QUESTION_ANSWER" && region.questionScores) {
        const validQuestionScores = region.questionScores.filter(
          (score) =>
            score.status !== "unscored" &&
            score.studentId !== null &&
            participatingStudentIds.includes(score.studentId) &&
            // partial/pending は partialScore が入力済みの場合のみ採点済みとする
            !(
              (score.status === "partial" || score.status === "pending") &&
              score.partialScore === null
            )
        )
        return total + validQuestionScores.length
      }
      return total
    }, 0) || 0

  const hasScoring =
    expectedScoringCount > 0 && actualScoringCount >= expectedScoringCount

  return {
    hasImages,
    hasLayout,
    hasRegionInfo,
    hasSubtotalRegions,
    hasSubtotalGroupSetting,
    hasStudents,
    hasAnswers,
    hasScoring,
    expectedScoringCount,
    actualScoringCount,
    questionAnswerCount,
    answerSheetCount,
  }
}
