/**
 * 試験ステータス判定の共通ユーティリティ
 *
 * 試験一覧と詳細ページで統一されたステータス判定を提供
 */

import type { Exam, Tag } from "@prisma/client"

/**
 * 進捗計算 getExamProgress が読む最小入力形。
 * 一覧（fetch-exams-summary が返す軽量データ）と詳細（ExamForDetail）の双方がこれを満たすため、
 * 進捗計算は renderer の getExamProgress ただ1本に統合できる（main 側の二重実装を持たない）。
 * partialScore は IPC 越しに number へシリアライズ済み（null 判定のみに使用）。
 */
export interface ExamProgressSource {
  /** 模範解答ページ（件数のみ hasImages 判定に使用） */
  examPages: unknown[]
  /** 平坦化済み採点領域（type と採点状況） */
  cropRegions?: {
    type: string
    questionScores: {
      status: string
      examStudentId: string
      partialScore: number | null
    }[]
  }[]
  /** 平坦化済み答案画像 */
  answerImages?: { examStudentId: string }[]
  examStudents: { id: string; status: string }[]
  examSubtotalGroups: { id: string }[]
}

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
export function getExamProgress(exam: ExamProgressSource): ExamProgress {
  // 入力形を信頼し、基本的な存在チェックのみ実施
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
  const participatingExamStudentIds =
    exam.examStudents
      ?.filter(
        (examStudent) =>
          examStudent.status === "participating" ||
          examStudent.status === "expected"
      )
      ?.map((examStudent) => examStudent.id) || []

  // 受験・見込み生徒の数をカウント（複数ページの答案でも1人1回のみ）
  const answerSheetCount = new Set(
    exam.answerImages
      ?.filter((answerImage) =>
        participatingExamStudentIds.includes(answerImage.examStudentId)
      )
      ?.map((answerImage) => answerImage.examStudentId)
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
            participatingExamStudentIds.includes(score.examStudentId) &&
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

/**
 * 試験一覧の「次のステップ」表示（8段階ワークフローの現在地）。
 * 表示文言・遷移 URL・着手可否という presentation 情報であり、renderer 側で導出する。
 */
export interface ExamWorkflowStatus {
  step: number
  action: string
  text: string
  url: string
  isCompleted: boolean
  canStart: boolean
}

/**
 * ExamProgress（DB 事実）から一覧の「次のステップ」表示を導出する。
 * 表示文言・renderer のルート URL を含むため、main ではなく renderer 側の唯一の実装とする。
 */
export function getExamWorkflowStatus(
  progress: ExamProgress,
  examId: string
): ExamWorkflowStatus {
  const {
    hasImages,
    hasLayout,
    hasRegionInfo,
    hasSubtotalGroupSetting,
    hasStudents,
    hasAnswers,
    hasScoring,
  } = progress

  if (!hasImages)
    return {
      step: 1,
      action: "upload",
      text: "模範解答画像の管理",
      url: `/exams/${examId}/01-upload`,
      isCompleted: false,
      canStart: true,
    }
  if (!hasLayout)
    return {
      step: 2,
      action: "template",
      text: "答案の採点領域作成",
      url: `/exams/${examId}/02-template`,
      isCompleted: false,
      canStart: hasImages,
    }
  if (!hasRegionInfo)
    return {
      step: 3,
      action: "region-info",
      text: "採点領域の詳細情報設定",
      url: `/exams/${examId}/03-region-info`,
      isCompleted: false,
      canStart: hasLayout,
    }
  if (!hasSubtotalGroupSetting)
    return {
      step: 4,
      action: "question-group",
      text: "小計点の設定",
      url: `/exams/${examId}/04-question-group`,
      isCompleted: false,
      canStart: hasRegionInfo,
    }
  if (!hasStudents)
    return {
      step: 5,
      action: "students",
      text: "受験生徒の管理",
      url: `/exams/${examId}/05-students`,
      isCompleted: false,
      canStart: hasSubtotalGroupSetting,
    }
  if (!hasAnswers)
    return {
      step: 6,
      action: "student-answers",
      text: "生徒答案の追加と関連付け",
      url: `/exams/${examId}/06-student-answers`,
      isCompleted: false,
      canStart: hasStudents,
    }
  if (!hasScoring)
    return {
      step: 7,
      action: "score-at-once",
      text: "一括採点",
      url: `/exams/${examId}/07-score-at-once`,
      isCompleted: false,
      canStart: hasAnswers && hasRegionInfo,
    }

  return {
    step: 8,
    action: "export",
    text: "採点結果のファイル出力",
    url: `/exams/${examId}/08-export`,
    isCompleted: false,
    canStart: hasScoring,
  }
}

/**
 * 試験一覧の読み取りモデル（fetch-exams-summary の要素）。
 * 表示フィールドは Exam に追随（Prisma 派生）し、進捗の元データ（ExamProgressSource）を同梱する。
 * 進捗・「次のステップ」表示はいずれも renderer で導出する
 * （getExamProgress → getExamWorkflowStatus。main 側では計算しない）。
 */
export type ExamSummary = Pick<
  Exam,
  "id" | "examName" | "examDate" | "description" | "createdAt" | "updatedAt"
> & {
  tags: Pick<Tag, "id" | "name" | "color">[]
} & ExamProgressSource
