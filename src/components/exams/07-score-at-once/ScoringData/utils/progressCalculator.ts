import type {
  CropRegionWithExamPage,
  QuestionProgress,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/ScoringData/types"
import { findQuestionScore } from "@/components/exams/07-score-at-once/types"
import type { SerializedQuestionScore } from "@/types/prismaExtensions"

/** 各設問の採点進捗（採点済み件数・割合）を計算する */
export function calculateQuestionProgress(
  cropRegions: CropRegionWithExamPage[],
  pageImages: StudentAnswerImageWithExamStudents[],
  questionScores: SerializedQuestionScore[]
): QuestionProgress {
  const progress: QuestionProgress = {}

  cropRegions.forEach((cropRegion, _cropRegionIndex) => {
    // このCropRegionが属するExamPageのID
    const cropRegionExamPageId = cropRegion.examPageId

    if (!cropRegionExamPageId) {
      console.warn("⚠️ CropRegion has no examPageId:", {
        cropRegionId: cropRegion.id,
        label: cropRegion.label,
        examPageId: cropRegion.examPageId,
      })
    }

    // ExamPageIDでフィルタリング（正しい方法）
    const samePageImages = pageImages.filter(
      (pageImage) => pageImage.examPageId === cropRegion.examPageId
    )

    // 答案は必ず受験者に紐づくので、ここでの絞り込みは不要
    const relevantPageImages = samePageImages

    const totalAnswers = relevantPageImages.length
    let gradedAnswers = 0
    let finalizedAnswers = 0

    relevantPageImages.forEach((pageImage) => {
      const score = findQuestionScore(
        questionScores,
        pageImage.examStudentId,
        cropRegion.id
      )
      const isGraded =
        score &&
        score.status !== "unscored" &&
        // partial/pending は partialScore が入力済みの場合のみ採点済みとする
        !(
          (score.status === "partial" || score.status === "pending") &&
          score.partialScore === null
        )

      if (isGraded) {
        gradedAnswers++
        // 保留は採点済みだが確定ではない
        if (score.status !== "pending") {
          finalizedAnswers++
        }
      }
    })

    const percentage =
      totalAnswers > 0 ? Math.round((gradedAnswers / totalAnswers) * 100) : 0

    progress[cropRegion.id] = {
      totalAnswers,
      gradedAnswers,
      finalizedAnswers,
      percentage,
    }
  })

  // 0/0 の問題がある場合の警告
  const zeroZeroQuestions = Object.entries(progress).filter(
    ([_, data]) => data.totalAnswers === 0 && data.gradedAnswers === 0
  )

  if (zeroZeroQuestions.length > 0) {
    console.warn(
      "🚨 Found 0/0 progress questions:",
      zeroZeroQuestions.map(([id, data]) => ({
        questionId: id,
        ...data,
      }))
    )
  }

  return progress
}
