import type { ScoringDataRecord } from "@/components/projects/07-score-at-once/ScoringData/types/scoring-data-types"

/**
 * Auto-finalization logic for collaborative grading
 */
export async function checkForAutoFinalization(
  studentId: string,
  cropRegionId: string,
  currentUserId: string | null,
  setScoringData: React.Dispatch<React.SetStateAction<ScoringDataRecord>>,
): Promise<void> {
  if (!currentUserId) return

  try {
    const comparison = await window.electronAPI.getQuestionScoreComparison(
      studentId,
      cropRegionId,
    )

    if (
      (comparison as any).success &&
      (comparison as any).proposedScores &&
      (comparison as any).proposedScores.length > 1
    ) {
      // Check if all proposed scores are identical
      const firstScore = (comparison as any).proposedScores[0]
      const allMatch = (comparison as any).proposedScores.every(
        (score: any) =>
          score.score === firstScore.score &&
          score.status === firstScore.status,
      )

      if (allMatch) {
        // Auto-finalize if all scores match
        const finalizeData = {
          partialScore: firstScore.score,
          status: "final",
          comments: firstScore.comment || "",
        }
        const result = await window.electronAPI.finalizeQuestionScore(
          studentId,
          cropRegionId,
          currentUserId,
          finalizeData,
        )

        if ((result as any).success) {
          // Update local scoring data to reflect finalization
          const key = `${studentId}-${cropRegionId}`
          setScoringData((prev) => ({
            ...prev,
            [key]: {
              ...prev[key],
              status: "final",
              version:
                (result as any).score?.version || (result as any).version,
              updatedAt: new Date(
                (result as any).score?.updatedAt || (result as any).updatedAt,
              ),
            },
          }))
        }
      }
    }
  } catch (error) {
    console.error("Error in auto-finalization:", error)
  }
}
