import type { QuestionScore } from "@/components/projects/07-score-at-once/types"
import { decimalToNumber } from "@/components/projects/07-score-at-once/types"

/**
 * 既存の採点データを読み込む関数（QuestionScore配列で返す）
 * @param projectId プロジェクトID
 * @param userId ユーザーID（指定時はそのユーザーの採点データのみ取得）
 */
export async function loadQuestionScores(
  projectId: string,
  userId?: string
): Promise<QuestionScore[]> {
  try {
    const result = await window.electronAPI.getQuestionScoresForProject(
      projectId,
      userId
    )

    // Handle both direct array and { success, scores } format
    let scores: QuestionScore[]
    if (Array.isArray(result)) {
      scores = result
    } else if (result?.success && Array.isArray(result.scores)) {
      scores = result.scores
    } else {
      return []
    }

    // Prisma.DecimalをNumberに変換してQuestionScore配列として返す
    return scores.map((score) => ({
      ...score,
      partialScore: decimalToNumber(score.partialScore),
    })) as QuestionScore[]
  } catch (error) {
    console.error("Failed to load question scores:", error)
    return []
  }
}

// getActualScore関数は削除 - shared.types.tsのcalculateActualScoreを使用
