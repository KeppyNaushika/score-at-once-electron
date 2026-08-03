import { useCallback, useState } from "react"

import { useBatchScoring } from "@/components/exams/07-score-at-once/ScoringData/hooks/useBatchScoring"
import type {
  CropRegionWithExamPage,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/ScoringData/types"
import { loadQuestionScores } from "@/components/exams/07-score-at-once/ScoringData/utils/dataLoader"
import { calculateQuestionProgress } from "@/components/exams/07-score-at-once/ScoringData/utils/progressCalculator"
import type { SerializedQuestionScore } from "@/types/prismaExtensions"

interface UseScoringDataProps {
  currentUserId: string | null
  setCurrentUserId: (userId: string) => void
  currentCropRegionId: string | null
  studentAnswerImages: StudentAnswerImageWithExamStudents[]
  cropRegions: CropRegionWithExamPage[]
}

/** 採点データの取得・一括採点・進捗計算を統合的に管理するフック */
export function useScoringData({
  currentUserId,
  setCurrentUserId,
  currentCropRegionId,
  studentAnswerImages,
  cropRegions,
}: UseScoringDataProps) {
  const [questionScores, setQuestionScores] = useState<
    SerializedQuestionScore[]
  >([])

  // Batch scoring hook
  const { handleBatchScore } = useBatchScoring({
    studentAnswerImages,
    cropRegions,
    currentCropRegionId,
    currentUserId,
    setCurrentUserId,
    questionScores,
    setQuestionScores,
  })

  // Data loading function wrapper
  // currentUserIdを使って、ログインユーザーの採点データのみを取得
  const loadQuestionScoresCallback = useCallback(
    async (examId: string) => {
      return await loadQuestionScores(examId, currentUserId ?? undefined)
    },
    [currentUserId]
  )

  // Progress calculation function
  const calculateQuestionProgressCallback = useCallback(() => {
    return calculateQuestionProgress(
      cropRegions,
      studentAnswerImages,
      questionScores
    )
  }, [studentAnswerImages, cropRegions, questionScores])

  return {
    questionScores,
    setQuestionScores,
    loadQuestionScores: loadQuestionScoresCallback,
    handleBatchScore,
    calculateQuestionProgress: calculateQuestionProgressCallback,
  }
}
