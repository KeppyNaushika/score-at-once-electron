import type {
  ClientQuestionScore,
  QuestionScore,
  ScoringDataRecord,
  ScoringStatus,
} from "@/components/projects/07-score-at-once/types/shared.types"

/**
 * 既存の採点データを読み込む関数
 */
export async function loadExistingScoringData(
  projectId: string,
): Promise<ScoringDataRecord> {
  try {
    const result =
      await window.electronAPI.getQuestionScoresForProject(projectId)

    // Handle both direct array and { success, scores } format
    let scores
    if (Array.isArray(result)) {
      scores = result
    } else if (result?.success && Array.isArray(result.scores)) {
      scores = result.scores
    } else {
      return {}
    }

    const scoringData: ScoringDataRecord = {}
    scores.forEach((score: QuestionScore) => {
      const key = `${score.studentId}-${score.cropRegionId}`
      // PrismaのQuestionScore（Decimal）をClientQuestionScore（number）に変換
      const clientScore: ClientQuestionScore = {
        ...score,
        partialScore: score.partialScore ? Number(score.partialScore) : null,
      }
      scoringData[key] = clientScore
    })

    return scoringData
  } catch (error) {
    console.error("Failed to load existing scoring data:", error)
    return {}
  }
}

/**
 * 採点状況を取得する関数
 */
export function getScoringStatus(
  scoringData: ScoringDataRecord,
  studentId: string,
  cropRegionId?: string,
): ScoringStatus {
  if (!cropRegionId) return "unscored"

  const key = `${studentId}-${cropRegionId}`
  const scoreData = scoringData[key]

  if (!scoreData) return "unscored"
  return scoreData.status as ScoringStatus
}

// getActualScore関数は削除 - shared.types.tsのcalculateActualScoreを使用
