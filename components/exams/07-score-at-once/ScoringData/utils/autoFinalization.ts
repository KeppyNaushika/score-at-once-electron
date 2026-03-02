import type { ScoringDataRecord } from "@/components/exams/07-score-at-once/ScoringData/types/scoringDataTypes"

/**
 * Auto-finalization logic for collaborative grading
 * 複数教員が同一採点を行った場合に自動的に最終決定を行う
 */
export async function checkForAutoFinalization(
  studentId: string,
  cropRegionId: string,
  currentUserId: string | null,
  setScoringData: React.Dispatch<React.SetStateAction<ScoringDataRecord>>
): Promise<void> {
  if (!currentUserId) return

  try {
    const comparison = await window.electronAPI.getQuestionScoreComparison(
      studentId,
      cropRegionId
    )

    if (
      comparison.success &&
      comparison.proposedScores &&
      comparison.proposedScores.length > 1
    ) {
      // Check if all proposed scores are identical
      const firstScore = comparison.proposedScores[0]
      const allMatch = comparison.proposedScores.every(
        (score) =>
          Number(score.partialScore) === Number(firstScore.partialScore) &&
          score.status === firstScore.status
      )

      if (allMatch) {
        // Auto-finalize if all scores match
        const finalizeData = {
          partialScore: Number(firstScore.partialScore) || 0,
          status: "final",
          comments: "",
        }
        const result = await window.electronAPI.finalizeQuestionScore(
          studentId,
          cropRegionId,
          currentUserId,
          finalizeData
        )

        if (result.success && result.score) {
          // Update local scoring data to reflect finalization
          const key = `${studentId}-${cropRegionId}`
          setScoringData((prev) => ({
            ...prev,
            [key]: {
              ...prev[key],
              status: "final",
              updatedAt: new Date(result.score!.updatedAt),
            },
          }))
        }
      }
    }
  } catch (error) {
    console.error("Error in auto-finalization:", error)
  }
}
