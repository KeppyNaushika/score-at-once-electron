import { useBatchScoring } from "@/components/projects/07-score-at-once/ScoringData/hooks/useBatchScoring"
import type {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
} from "@/components/projects/07-score-at-once/ScoringData/types/scoringDataTypes"
import { loadQuestionScores } from "@/components/projects/07-score-at-once/ScoringData/utils/dataLoader"
import { calculateQuestionProgress } from "@/components/projects/07-score-at-once/ScoringData/utils/progressCalculator"
import { type QuestionScore } from "@/components/projects/07-score-at-once/types"
import { useCallback, useState } from "react"

interface UseScoringDataProps {
  currentUserId: string | null
  setCurrentUserId: (userId: string) => void
  currentCropRegionId: string | null
  pageImages: PageImageWithProjectStudents[]
  cropRegions: CropRegionWithProjectPage[]
}

export function useScoringData({
  currentUserId,
  setCurrentUserId,
  currentCropRegionId,
  pageImages,
  cropRegions,
}: UseScoringDataProps) {
  const [questionScores, setQuestionScores] = useState<QuestionScore[]>([])

  // Batch scoring hook
  const { handleBatchScore } = useBatchScoring({
    pageImages,
    cropRegions,
    currentCropRegionId,
    currentUserId,
    setCurrentUserId,
    questionScores,
    setQuestionScores,
  })

  // Data loading function wrapper
  const loadQuestionScoresCallback = useCallback(async (projectId: string) => {
    return await loadQuestionScores(projectId)
  }, [])

  // Progress calculation function
  const calculateQuestionProgressCallback = useCallback(() => {
    return calculateQuestionProgress(cropRegions, pageImages, questionScores)
  }, [pageImages, cropRegions, questionScores])

  return {
    questionScores,
    setQuestionScores,
    loadQuestionScores: loadQuestionScoresCallback,
    handleBatchScore,
    calculateQuestionProgress: calculateQuestionProgressCallback,
  }
}
