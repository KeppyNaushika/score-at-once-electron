import { useCallback } from "react"

import { useBatchScoring } from "@/components/exams/07-score-at-once/ScoringData/hooks/useBatchScoring"
import { calculateQuestionProgress } from "@/components/exams/07-score-at-once/ScoringData/utils/progressCalculator"
import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

interface UseScoringDataProps {
  examId: string
  currentUserId: string | null
  currentCropRegionId: string | null
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  cropRegions: QuestionAnswerRegionRow[]
}

/**
 * 一括採点と進捗計算をまとめるフック。
 *
 * **採点行はここで取らない。** 採点行は採点領域（`cropRegions`）の子として
 * 既に届いている。`QuestionScore` を根にもう一度取ると、同じ行が別のキーで
 * 2度キャッシュされ、`(examStudentId, cropRegionId)` で探し直すことになる。
 */
export function useScoringData({
  examId,
  currentUserId,
  currentCropRegionId,
  studentAnswerImages,
  cropRegions,
}: UseScoringDataProps) {
  const { handleBatchScore } = useBatchScoring({
    examId,
    studentAnswerImages,
    cropRegions,
    currentCropRegionId,
    currentUserId,
  })

  const calculateQuestionProgressCallback = useCallback(
    () =>
      calculateQuestionProgress(
        cropRegions,
        studentAnswerImages,
        currentUserId
      ),
    [studentAnswerImages, cropRegions, currentUserId]
  )

  return {
    handleBatchScore,
    calculateQuestionProgress: calculateQuestionProgressCallback,
  }
}
