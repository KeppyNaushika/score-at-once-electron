import prisma from "./client"

/**
 * 試験の採点レコードを初期化する
 * 全ての答案と採点領域の組み合わせに対して初期の採点レコードを作成
 *
 * 採点領域も受験者も同じ examId から引くため、両者が別の試験のものになることは
 * 構造的に起こらない（examScopeGuard による検査を足す必要が無い唯一の書き込み経路）。
 */
export const initializeScoringRecords = async (examId: string) => {
  try {
    return await prisma.$transaction(
      async (tx) => {
        // 試験の全ての採点領域を取得
        const questionRegions = await tx.cropRegion.findMany({
          where: {
            examPage: {
              examId,
            },
            type: "QUESTION_ANSWER",
          },
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
          include: {
            questionScores: {
              where: {
                cropRegionId: { in: regionIds },
                userId: defaultUser.id,
              },
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
      },
      // 既存採点行を行ごと読んでから createMany するため、採点済みの大きな試験では
      // 対話トランザクションの既定5秒を超える。読み取りを外へ出すと重複行を作りうる
      // （QuestionScore に (examStudentId, cropRegionId, userId) の unique が無い）ので、
      // 同一トランザクションに留めたまま制限時間を明示する。
      { timeout: 60_000 }
    )
  } catch (error) {
    console.error("Failed to initialize scoring records:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
