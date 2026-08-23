import { useCallback } from "react"

import { useBatchScoring } from "@/components/exams/07-score-at-once/ScoringData/hooks/useBatchScoring"
import { calculateQuestionProgress } from "@/components/exams/07-score-at-once/ScoringData/utils/progressCalculator"
import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"

interface UseScoringDataProps {
  examId: string
  currentUserId: string
  currentCropRegionId: string | null
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  cropRegions: QuestionAnswerRegionRow[]
  questionScoresByCropRegionId: Map<string, QuestionScoreRow[]>
}

/**
 * 一括採点と進捗計算をまとめるフック。
 *
 * **採点行はここで取らない。** 設問ごとのキーから既に届いている
 * （`useScoringDataLoader`）。ここでもう一度取ると、同じ行が別のキーで2度
 * キャッシュされる。
 */
export function useScoringData({
  examId,
  currentUserId,
  currentCropRegionId,
  studentAnswerImages,
  cropRegions,
  questionScoresByCropRegionId,
}: UseScoringDataProps) {
  const { handleBatchScore } = useBatchScoring({
    examId,
    studentAnswerImages,
    cropRegions,
    questionScoresByCropRegionId,
    currentCropRegionId,
    currentUserId,
  })

  const calculateQuestionProgressCallback = useCallback(
    () =>
      calculateQuestionProgress(
        cropRegions,
        questionScoresByCropRegionId,
        studentAnswerImages,
        currentUserId
      ),
    [
      studentAnswerImages,
      cropRegions,
      questionScoresByCropRegionId,
      currentUserId,
    ]
  )

  return {
    handleBatchScore,
    calculateQuestionProgress: calculateQuestionProgressCallback,
  }
}
