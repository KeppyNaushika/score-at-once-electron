import prisma from "./client"

/**
 * 試験の採点レコードを初期化する
 * 全ての答案と採点領域の組み合わせに対して初期の採点レコードを作成
 */
export const initializeScoringRecords = async (examId: string) => {
  try {
    return await prisma.$transaction(async (tx) => {
      // 試験の全ての採点領域を取得
      const questionRegions = await tx.cropRegion.findMany({
        where: {
          examPage: {
            examId,
          },
          type: "QUESTION_ANSWER",
        },
        select: { id: true },
      })

      // デフォルトユーザーを取得（現在のユーザー認証システムがないため）
      const defaultUser = await tx.user.findFirst()
      if (!defaultUser) {
        throw new Error("No default user found for scoring initialization")
      }

      const regionIds = questionRegions.map((region) => region.id)

      // 受験者ごとに、その受験者が既に持つ採点行を子として同梱して引く。
      // 採点行は ExamStudent の子なので、受験者の内側だけで既存判定が閉じる
      // （生徒IDと設問IDを連結した文字列キーで突き合わせる必要が無い）。
      const examStudents = await tx.examStudent.findMany({
        where: { examId },
        select: {
          id: true,
          questionScores: {
            where: {
              cropRegionId: { in: regionIds },
              userId: defaultUser.id,
            },
            select: { cropRegionId: true },
          },
        },
      })

      const scoringRecords = []

      // 全ての受験者×採点領域の組み合わせを作成
      for (const examStudent of examStudents) {
        const scoredRegionIds = new Set(
          examStudent.questionScores.map(
            (questionScore) => questionScore.cropRegionId
          )
        )
        for (const region of questionRegions) {
          if (!scoredRegionIds.has(region.id)) {
            scoringRecords.push({
              examStudentId: examStudent.id,
              cropRegionId: region.id,
              partialScore: null,
              status: "unscored",
              userId: defaultUser.id,
            })
          }
        }
      }

      // 一括作成（重複は既にチェック済みなので、素直に作成）
      if (scoringRecords.length > 0) {
        await tx.questionScore.createMany({
          data: scoringRecords,
        })
      }

      return {
        success: true,
        initialized: scoringRecords.length,
        message: `${scoringRecords.length} scoring records initialized`,
      }
    })
  } catch (error) {
    console.error("Failed to initialize scoring records:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
