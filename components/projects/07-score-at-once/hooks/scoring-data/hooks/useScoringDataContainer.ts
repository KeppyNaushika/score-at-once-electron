import { useBatchScoring } from "@/components/projects/07-score-at-once/hooks/scoring-data/hooks/useBatchScoring"
import { useIndividualScoring } from "@/components/projects/07-score-at-once/hooks/scoring-data/hooks/useIndividualScoring"
import type {
  ScoringDataRecord,
  UseScoringDataProps,
} from "@/components/projects/07-score-at-once/hooks/scoring-data/types/scoring-data-types"
import {
  getScoringStatus,
  loadExistingScoringData,
} from "@/components/projects/07-score-at-once/hooks/scoring-data/utils/data-loader"
import { calculateQuestionProgress } from "@/components/projects/07-score-at-once/hooks/scoring-data/utils/progress-calculator"
import { calculateActualScore } from "@/components/projects/07-score-at-once/types/shared.types"
import { useCallback, useState } from "react"

export function useScoringDataContainer({
  currentUserId,
  setCurrentUserId,
  gradingMode,
  currentStudentIndex,
  setCurrentStudentIndex,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  pageImages,
  cropRegions,
}: UseScoringDataProps) {
  const [scoringData, setScoringData] = useState<ScoringDataRecord>({})

  // Individual scoring hook
  const { handleSetScore } = useIndividualScoring({
    pageImages,
    cropRegions,
    currentStudentIndex,
    currentQuestionIndex,
    currentUserId,
    scoringData,
    gradingMode,
    setCurrentStudentIndex,
    setCurrentQuestionIndex,
    setScoringData,
  })

  // Batch scoring hook
  const { handleBatchScore } = useBatchScoring({
    pageImages,
    cropRegions,
    currentQuestionIndex,
    currentUserId,
    setCurrentUserId,
    scoringData,
    setScoringData,
  })

  // Data loading function wrapper
  const loadExistingScoringDataCallback = useCallback(
    async (projectId: string) => {
      return await loadExistingScoringData(projectId)
    },
    [],
  )

  // Status and score getter functions
  const getScoringStatusCallback = useCallback(
    (studentId: string, questionId?: string) => {
      return getScoringStatus(scoringData, studentId, questionId)
    },
    [scoringData],
  )

  const getActualScoreCallback = useCallback(
    (studentId: string, questionId?: string, maxScore: number = 0) => {
      if (!questionId) return null
      const key = `${studentId}-${questionId}`
      const scoreData = scoringData[key]
      return calculateActualScore(scoreData || null, maxScore)
    },
    [scoringData],
  )

  // Progress calculation function
  const calculateQuestionProgressCallback = useCallback(() => {
    return calculateQuestionProgress(cropRegions, pageImages, scoringData)
  }, [pageImages, cropRegions, scoringData])

  return {
    scoringData,
    setScoringData,
    loadExistingScoringData: loadExistingScoringDataCallback,
    getScoringStatus: getScoringStatusCallback,
    getActualScore: getActualScoreCallback,
    handleSetScore,
    handleBatchScore,
    calculateQuestionProgress: calculateQuestionProgressCallback,
  }
}
