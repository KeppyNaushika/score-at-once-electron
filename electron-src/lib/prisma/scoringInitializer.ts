import prisma from "./client"

/**
 * プロジェクトの採点レコードを初期化する
 * 全ての答案と採点領域の組み合わせに対して初期の採点レコードを作成
 */
export const initializeScoringRecords = async (projectId: string) => {
  try {
    return await prisma.$transaction(async (tx) => {
      // プロジェクトの全ての答案を取得
      const answerSheets = await tx.answerSheet.findMany({
        where: { projectId },
        select: { id: true }
      })

      // プロジェクトの全ての採点領域を取得
      const questionRegions = await tx.layoutRegion.findMany({
        where: { 
          projectId,
          type: "QUESTION_ANSWER"
        },
        select: { id: true }
      })

      // デフォルトユーザーを取得（現在のユーザー認証システムがないため）
      const defaultUser = await tx.user.findFirst()
      if (!defaultUser) {
        throw new Error("No default user found for scoring initialization")
      }

      const scoringRecords = []

      // 全ての答案×採点領域の組み合わせを作成
      for (const answerSheet of answerSheets) {
        for (const region of questionRegions) {
          // 既存レコードをチェック
          const existing = await tx.questionScore.findFirst({
            where: {
              answerSheetId: answerSheet.id,
              layoutRegionId: region.id,
              scoredByUserId: defaultUser.id
            }
          })

          if (!existing) {
            scoringRecords.push({
              answerSheetId: answerSheet.id,
              layoutRegionId: region.id,
              score: null,
              status: "ungraded",
              comment: "",
              scoredByUserId: defaultUser.id,
              scoreVersion: 1
            })
          }
        }
      }

      // 一括作成（重複は既にチェック済みなので、素直に作成）
      if (scoringRecords.length > 0) {
        await tx.questionScore.createMany({
          data: scoringRecords
        })
      }

      return {
        success: true,
        initialized: scoringRecords.length,
        message: `${scoringRecords.length} scoring records initialized`
      }
    })
  } catch (error) {
    console.error("Failed to initialize scoring records:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}