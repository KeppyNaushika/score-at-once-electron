import type { QuestionScore } from "@/components/exams/07-score-at-once/types"
import { decimalToNumber } from "@/components/exams/07-score-at-once/types"

/**
 * 既存の採点データを読み込む関数（QuestionScore配列で返す）
 * @param examId 試験ID
 * @param userId ユーザーID（指定時はそのユーザーの採点データのみ取得）
 */
export async function loadQuestionScores(
  examId: string,
  userId?: string
): Promise<QuestionScore[]> {
  try {
    const result = await window.electronAPI.getQuestionScoresForExam(
      examId,
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
