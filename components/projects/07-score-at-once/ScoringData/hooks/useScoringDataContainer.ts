import { useBatchScoring } from "@/components/projects/07-score-at-once/ScoringData/hooks/useBatchScoring"
import { useIndividualScoring } from "@/components/projects/07-score-at-once/ScoringData/hooks/useIndividualScoring"
import type { UseScoringDataProps } from "@/components/projects/07-score-at-once/ScoringData/types/scoring-data-types"
import { loadQuestionScores } from "@/components/projects/07-score-at-once/ScoringData/utils/data-loader"
import { calculateQuestionProgress } from "@/components/projects/07-score-at-once/ScoringData/utils/progress-calculator"
import {
  calculateActualScore,
  findQuestionScore,
  getScoringStatusFromArray,
  type QuestionScore,
} from "@/components/projects/07-score-at-once/types"
import { useCallback, useState } from "react"

export function useScoringDataContainer({
  currentUserId,
  setCurrentUserId,
  gradingMode,
  currentStudentIndex,
  setCurrentStudentIndex,
  currentCropRegionId,
  setCurrentCropRegionId,
  pageImages,
  cropRegions,
}: UseScoringDataProps) {
  const [questionScores, setQuestionScores] = useState<QuestionScore[]>([])

  // Individual scoring hook
  const { handleSetScore } = useIndividualScoring({
    pageImages,
    cropRegions,
    currentStudentIndex,
    currentCropRegionId,
    currentUserId,
    questionScores,
    gradingMode,
    setCurrentStudentIndex,
    setCurrentCropRegionId,
    setQuestionScores,
  })

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

  // Status and score getter functions
  const getScoringStatusCallback = useCallback(
    (studentId: string, questionId?: string) => {
      return getScoringStatusFromArray(questionScores, studentId, questionId)
    },
    [questionScores],
  )

  const getActualScoreCallback = useCallback(
    (studentId: string, questionId?: string, maxScore: number = 0) => {
      if (!questionId) return null
      const score = findQuestionScore(questionScores, studentId, questionId)
      // QuestionScoreの場合はpartialScoreが既にnumberに変換されているので、そのまま使用
      if (!score) return null
      return score.partialScore !== null ? score.partialScore : null
    },
    [questionScores],
  )

  // Progress calculation function
  const calculateQuestionProgressCallback = useCallback(() => {
    return calculateQuestionProgress(cropRegions, pageImages, questionScores)
  }, [pageImages, cropRegions, questionScores])

  return {
    questionScores,
    setQuestionScores,
    loadQuestionScores: loadQuestionScoresCallback,
    getScoringStatus: getScoringStatusCallback,
    getActualScore: getActualScoreCallback,
    handleSetScore,
    handleBatchScore,
    calculateQuestionProgress: calculateQuestionProgressCallback,
  }
}
