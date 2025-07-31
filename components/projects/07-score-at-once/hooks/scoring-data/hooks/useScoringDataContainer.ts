import { useCallback, useState } from "react"
import type {
  UseScoringDataProps,
  ScoringDataRecord,
} from "@/components/projects/07-score-at-once/hooks/scoring-data/types/scoring-data-types"
import {
  loadExistingScoringData,
  getScoringStatus,
  getActualScore,
} from "@/components/projects/07-score-at-once/hooks/scoring-data/utils/data-loader"
import { calculateQuestionProgress } from "@/components/projects/07-score-at-once/hooks/scoring-data/utils/progress-calculator"
import { useIndividualScoring } from "@/components/projects/07-score-at-once/hooks/scoring-data/hooks/useIndividualScoring"
import { useBatchScoring } from "@/components/projects/07-score-at-once/hooks/scoring-data/hooks/useBatchScoring"

export function useScoringDataContainer({
  currentUserId,
  setCurrentUserId,
  gradingMode,
  currentStudentIndex,
  setCurrentStudentIndex,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  answerSheets,
  questionRegions,
}: UseScoringDataProps) {
  const [scoringData, setScoringData] = useState<ScoringDataRecord>({})

  // Individual scoring hook
  const { handleSetScore } = useIndividualScoring({
    answerSheets,
    questionRegions,
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
    answerSheets,
    questionRegions,
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
      return getActualScore(scoringData, studentId, questionId, maxScore)
    },
    [scoringData],
  )

  // Progress calculation function
  const calculateQuestionProgressCallback = useCallback(() => {
    return calculateQuestionProgress(questionRegions, answerSheets, scoringData)
  }, [answerSheets, questionRegions, scoringData])

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