/**
 * プロジェクトステータス判定の共通ユーティリティ
 *
 * プロジェクト一覧と詳細ページで統一されたステータス判定を提供
 */

import { ProjectWithDetails } from "@/types/common.types"

// プロジェクトステータスの型定義
export interface ProjectStatus {
  step: number
  action: string
  text: string
  url: string
  isCompleted: boolean
  canStart: boolean
}

// 詳細なプロジェクト進捗情報
export interface ProjectProgress {
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
 * プロジェクトの詳細進捗情報を計算
 */
export function getProjectProgress(
  project: ProjectWithDetails
): ProjectProgress {
  // ProjectWithDetails型を信頼し、基本的な存在チェックのみ実施
  if (!project) {
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

  const hasImages = !!(project.projectPages && project.projectPages.length > 0)
  const hasLayout = !!(project.cropRegions && project.cropRegions.length > 0)
  const hasRegionInfo = hasLayout // 領域情報は領域が存在すれば設定済みとみなす

  // 小計点領域が存在するかチェック
  const hasSubtotalRegions =
    project.cropRegions?.some((region) => region.type === "SUBTOTAL_SCORE") ||
    false

  // 小計点設定が完了しているかチェック（小計点領域がある場合のみ）
  const hasSubtotalGroupSetting = !!(
    !hasSubtotalRegions ||
    (project.projectSubtotalGroups && project.projectSubtotalGroups.length > 0)
  )

  const hasStudents = !!(
    project.projectStudents && project.projectStudents.length > 0
  )
  const hasAnswers = !!(project.answerImages && project.answerImages.length > 0)

  // 採点完了の精密な判定
  // QUESTION_ANSWER領域数 × 答案数 = 全採点すべき数
  const questionAnswerCount =
    project.cropRegions?.filter((region) => region.type === "QUESTION_ANSWER")
      .length || 0

  // 受験・見込み生徒のIDリストを取得（欠席生徒を除外）
  const participatingStudentIds =
    project.projectStudents
      ?.filter(
        (ps) => ps.status === "PARTICIPATING" || ps.status === "EXPECTED"
      )
      ?.map((ps) => ps.studentId) || []

  // 受験・見込み生徒の数をカウント（複数ページの答案でも1人1回のみ）
  const answerSheetCount = new Set(
    project.answerImages
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
    project.cropRegions?.reduce((total, region) => {
      if (region.type === "QUESTION_ANSWER" && region.questionScores) {
        const validQuestionScores = region.questionScores.filter(
          (score) =>
            score.status !== "unscored" &&
            score.studentId !== null &&
            participatingStudentIds.includes(score.studentId)
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
 * プロジェクトの現在のステータスを取得
 */
export function getProjectStatus(project: ProjectWithDetails): ProjectStatus {
  // ProjectWithDetails型を信頼し、基本的な存在チェックのみ実施
  if (!project?.id) {
    console.warn("Project missing required id:", project)
    return {
      step: 1,
      action: "upload",
      text: "データエラー",
      url: `/projects/unknown/01-upload`,
      isCompleted: false,
      canStart: true,
    }
  }

  const progress = getProjectProgress(project)

  if (!progress.hasImages)
    return {
      step: 1,
      action: "upload",
      text: "模範解答画像の管理",
      url: `/projects/${project.id}/01-upload`,
      isCompleted: false,
      canStart: true,
    }

  if (!progress.hasLayout)
    return {
      step: 2,
      action: "template",
      text: "答案の採点領域作成",
      url: `/projects/${project.id}/02-template`,
      isCompleted: false,
      canStart: progress.hasImages,
    }

  if (!progress.hasRegionInfo)
    return {
      step: 3,
      action: "region-info",
      text: "採点領域の詳細情報設定",
      url: `/projects/${project.id}/03-region-info`,
      isCompleted: false,
      canStart: progress.hasLayout,
    }

  if (!progress.hasSubtotalGroupSetting)
    return {
      step: 4,
      action: "question-group",
      text: "小計点の設定",
      url: `/projects/${project.id}/04-question-group`,
      isCompleted: false,
      canStart: progress.hasRegionInfo,
    }

  if (!progress.hasStudents)
    return {
      step: 5,
      action: "students",
      text: "受験生徒の管理",
      url: `/projects/${project.id}/05-students`,
      isCompleted: false,
      canStart: progress.hasSubtotalGroupSetting,
    }

  if (!progress.hasAnswers)
    return {
      step: 6,
      action: "student-answers",
      text: "生徒答案の追加と関連付け",
      url: `/projects/${project.id}/06-student-answers`,
      isCompleted: false,
      canStart: progress.hasStudents,
    }

  if (!progress.hasScoring) {
    return {
      step: 7,
      action: "score-at-once",
      text: "一括採点",
      url: `/projects/${project.id}/07-score-at-once`,
      isCompleted: false,
      canStart: progress.hasAnswers && progress.hasRegionInfo,
    }
  }

  // 全て完了している場合は出力段階
  return {
    step: 8,
    action: "export",
    text: "採点結果のファイル出力",
    url: `/projects/${project.id}/08-export`,
    isCompleted: false, // 出力は何度でも実行可能
    canStart: progress.hasScoring,
  }
}

/**
 * プロジェクトの全体的な完了率を計算
 */
export function getProjectCompletionRate(project: ProjectWithDetails): number {
  const progress = getProjectProgress(project)

  const completedSteps = [
    progress.hasImages,
    progress.hasLayout,
    progress.hasRegionInfo,
    progress.hasSubtotalGroupSetting,
    progress.hasStudents,
    progress.hasAnswers,
    progress.hasScoring,
  ].filter(Boolean).length

  return (completedSteps / 7) * 100
}

/**
 * ステップごとの完了状況を配列で取得
 */
export function getStepCompletionStatus(
  project: ProjectWithDetails
): boolean[] {
  const progress = getProjectProgress(project)

  return [
    progress.hasImages, // Step 1
    progress.hasLayout, // Step 2
    progress.hasRegionInfo, // Step 3
    progress.hasSubtotalGroupSetting, // Step 4
    progress.hasStudents, // Step 5
    progress.hasAnswers, // Step 6
    progress.hasScoring, // Step 7
    false, // Step 8 (出力は常に実行可能)
  ]
}
