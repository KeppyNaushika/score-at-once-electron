import type {
  QuestionScore,
  ScoringStatus,
} from "@/components/projects/07-score-at-once/types"
import { decimalToNumber } from "@/components/projects/07-score-at-once/types"

/**
 * 既存の採点データを読み込む関数（QuestionScore配列で返す）
 */
export async function loadQuestionScores(
  projectId: string,
): Promise<QuestionScore[]> {
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
      return []
    }

    // Prisma.DecimalをNumberに変換してQuestionScore配列として返す
    return scores.map((score: any) => ({
      ...score,
      partialScore: decimalToNumber(score.partialScore),
    })) as QuestionScore[]
  } catch (error) {
    console.error("Failed to load question scores:", error)
    return []
  }
}

// getActualScore関数は削除 - shared.types.tsのcalculateActualScoreを使用
