import type { SerializedQuestionScore } from "@/types/prismaExtensions"

/**
 * 既存の採点データを読み込む関数（QuestionScore配列で返す）
 * @param examId 試験ID
 * @param userId ユーザーID（指定時はそのユーザーの採点データのみ取得）
 */
export async function loadQuestionScores(
  examId: string,
  userId?: string
): Promise<SerializedQuestionScore[]> {
  try {
    const result = await window.electronAPI.getQuestionScoresForExam(
      examId,
      userId
    )

    // Handle both direct array and { success, scores } format
    if (Array.isArray(result)) {
      return result
    }
    if (result?.success && Array.isArray(result.scores)) {
      return result.scores
    }
    return []
  } catch (error) {
    console.error("Failed to load question scores:", error)
    return []
  }
}

// getActualScore関数は削除 - shared.types.tsのcalculateActualScoreを使用
