import type { QuestionScore, ScoringStatus } from "@/components/projects/07-score-at-once/ScoringMain/types"
import type { 
  ScoringDataRecord, 
  ClientQuestionScore 
} from "@/components/projects/07-score-at-once/hooks/scoring-data/types/scoring-data-types"

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
    scores.forEach((score: QuestionScore) => {
      const key = `${score.studentId}-${score.cropRegionId}`
      // PrismaのQuestionScore（Decimal）をClientQuestionScore（number）に変換
      const clientScore: ClientQuestionScore = {
        ...score,
        partialScore: score.partialScore ? Number(score.partialScore) : null
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
  cropRegionId?: string
): ScoringStatus {
  if (!cropRegionId) return "unscored"

  const key = `${studentId}-${cropRegionId}`
  const scoreData = scoringData[key]

  if (!scoreData) return "unscored"
  return scoreData.status as ScoringStatus
}

/**
 * 実際の得点を計算する関数
 */
export function getActualScore(
  scoringData: ScoringDataRecord,
  studentId: string,
  cropRegionId?: string,
  maxScore: number = 0
): number | null {
  if (!cropRegionId) return null

  const key = `${studentId}-${cropRegionId}`
  const scoreData = scoringData[key]

  if (!scoreData) return null

  // calculateActualScoreと同じロジック（ClientQuestionScoreのフィールドを使用）
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
      // partialScoreは既にnumber型なので、そのまま返す
      return scoreData.partialScore
    default:
      return 0
  }
}