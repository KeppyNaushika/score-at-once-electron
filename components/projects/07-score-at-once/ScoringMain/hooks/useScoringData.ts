import { useCallback, useState } from "react"

import { useBatchScoring } from "@/components/projects/07-score-at-once/ScoringData/hooks/useBatchScoring"
import type {
  CropRegionWithProjectPage,
  StudentAnswerImageWithProjectStudents,
} from "@/components/projects/07-score-at-once/ScoringData/types/scoringDataTypes"
import { loadQuestionScores } from "@/components/projects/07-score-at-once/ScoringData/utils/dataLoader"
import { calculateQuestionProgress } from "@/components/projects/07-score-at-once/ScoringData/utils/progressCalculator"
import { type QuestionScore } from "@/components/projects/07-score-at-once/types"

interface UseScoringDataProps {
  currentUserId: string | null
  setCurrentUserId: (userId: string) => void
  currentCropRegionId: string | null
  studentAnswerImages: StudentAnswerImageWithProjectStudents[]
  cropRegions: CropRegionWithProjectPage[]
}

export function useScoringData({
  currentUserId,
  setCurrentUserId,
  currentCropRegionId,
  studentAnswerImages,
  cropRegions,
}: UseScoringDataProps) {
  const [questionScores, setQuestionScores] = useState<QuestionScore[]>([])

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
    async (projectId: string) => {
      return await loadQuestionScores(projectId, currentUserId ?? undefined)
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
