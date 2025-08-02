import type { ScoringData, ScoringStatus } from "@/components/projects/07-score-at-once/ScoringMain/types"
import type { ScoringDataRecord } from "@/components/projects/07-score-at-once/hooks/scoring-data/types/scoring-data-types"

/**
 * 既存の採点データを読み込む関数
 */
export async function loadExistingScoringData(
  projectId: string
): Promise<ScoringDataRecord> {
  try {
    const result = await window.electronAPI.getQuestionScoresForProject(projectId)

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
    scores.forEach((score: any) => {
      const key = `${score.studentId}-${score.cropRegionId}`
      scoringData[key] = {
        id: score.id,
        questionId: score.cropRegionId,
        score: score.partialScore ? Number(score.partialScore) : null, // partialScoreを直接格納
        maxScore: 0, // We'll need to get this from the crop region
        status: score.status as ScoringStatus,
        comment: score.comment || "",
        scoredByUserId: score.scoredByUserId,
        version: score.version || 0,
        updatedAt: new Date(score.updatedAt),
      }
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
  questionId?: string
): ScoringStatus {
  if (!questionId) return "unscored"

  const key = `${studentId}-${questionId}`
  const scoreData = scoringData[key]

  if (!scoreData) return "unscored"
  return scoreData.status
}

/**
 * 実際の得点を計算する関数
 */
export function getActualScore(
  scoringData: ScoringDataRecord,
  studentId: string,
  questionId?: string,
  maxScore: number = 0
): number | null {
  if (!questionId) return null

  const key = `${studentId}-${questionId}`
  const scoreData = scoringData[key]

  if (!scoreData) return null

  // calculateActualScoreと同じロジック
  switch (scoreData.status) {
    case "correct":
    case "final":
      return maxScore
    case "incorrect":
    case "no_answer":
      return 0
    case "unscored":
      return null
    case "partial":
    case "pending":
    case "proposed":
      return scoreData.score
    default:
      return 0
  }
}