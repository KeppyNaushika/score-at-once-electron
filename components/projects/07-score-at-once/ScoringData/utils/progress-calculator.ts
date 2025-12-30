import type {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
  QuestionProgress,
} from "@/components/projects/07-score-at-once/ScoringData/types/scoring-data-types"
import {
  findQuestionScore,
  type QuestionScore,
} from "@/components/projects/07-score-at-once/types"

/**
 * 設問別進捗を計算する関数
 */
export function calculateQuestionProgress(
  cropRegions: CropRegionWithProjectPage[],
  pageImages: PageImageWithProjectStudents[],
  questionScores: QuestionScore[],
): QuestionProgress {
  const progress: QuestionProgress = {}

  cropRegions.forEach((cropRegion, _cropRegionIndex) => {
    // このCropRegionが属するProjectPageのID
    const cropRegionProjectPageId = cropRegion.projectPageId

    if (!cropRegionProjectPageId) {
      console.warn("⚠️ CropRegion has no projectPageId:", {
        cropRegionId: cropRegion.id,
        label: cropRegion.label,
        projectPageId: cropRegion.projectPageId,
      })
    }

    // ProjectPageIDでフィルタリング（正しい方法）
    const samePageImages = pageImages.filter(
      (pageImage) => pageImage.projectPageId === cropRegion.projectPageId,
    )

    // studentIdフィルタリング
    const relevantPageImages = samePageImages.filter(
      (pageImage) => pageImage.studentId,
    )

    const totalAnswers = relevantPageImages.length
    let gradedAnswers = 0

    relevantPageImages.forEach((pageImage, _index) => {
      if (!pageImage.studentId) return // studentIdがnullの場合はスキップ

      const score = findQuestionScore(
        questionScores,
        pageImage.studentId,
        cropRegion.id,
      )
      const isGraded = score && score.status !== "unscored"

      if (isGraded) {
        gradedAnswers++
      }
    })

    const percentage =
      totalAnswers > 0 ? Math.round((gradedAnswers / totalAnswers) * 100) : 0

    progress[cropRegion.id] = {
      totalAnswers,
      gradedAnswers,
      percentage,
    }
  })

  // 0/0 の問題がある場合の警告
  const zeroZeroQuestions = Object.entries(progress).filter(
    ([_, data]) => data.totalAnswers === 0 && data.gradedAnswers === 0,
  )

  if (zeroZeroQuestions.length > 0) {
    console.warn(
      "🚨 Found 0/0 progress questions:",
      zeroZeroQuestions.map(([id, data]) => ({
        questionId: id,
        ...data,
      })),
    )
  }

  return progress
}
