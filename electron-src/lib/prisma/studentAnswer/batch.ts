/**
 * 答案の一括操作
 * - 複数答案の一括配置変更
 * - 2つの答案の配置交換（採点情報込み）
 */
import type { QuestionScore } from "@prisma/client"
import prisma from "../client"

/**
 * 複数の答案の配置を一括で変更（採点情報の移行も対応）
 */
export async function batchUpdateStudentAnswerPlacements(
  moves: Array<{
    fileId: string
    finalStudentId: string | null
    finalPageNumber: number
  }>,
  withScoring: boolean = false
) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 移動対象の答案情報と採点データを取得
      const answerSheets = await Promise.all(
        moves.map((move) =>
          tx.pageImage.findUnique({
            where: { id: move.fileId },
            select: {
              id: true,
              studentId: true,
              projectPage: {
                select: {
                  projectId: true,
                  pageNumber: true,
                },
              },
            },
          })
        )
      )

      // 見つからない答案をチェック
      const missingSheets = moves.filter((_, index) => !answerSheets[index])
      if (missingSheets.length > 0) {
        throw new Error(
          `答案が見つかりません: ${missingSheets.map((m) => m.fileId).join(", ")}`
        )
      }

      let allQuestionScores: QuestionScore[] = []

      if (withScoring) {
        // 全ての採点データを取得
        // TODO: QuestionScore querying needs to be updated for new schema
        // In new schema, scores are linked to students and crop regions, not answer sheets directly
        allQuestionScores = [] // await tx.questionScore.findMany({
        //   where: {
        //     studentId: {
        //       in: moves.map(m => m.finalStudentId).filter(Boolean)
        //     }
        //   },
        // })

        // TODO: Delete scoring data needs to be updated for new schema
        // 一時的に採点データを削除（制約回避）
        // await tx.questionScore.deleteMany({
        //   where: {
        //     studentId: {
        //       in: moves.map(m => m.finalStudentId).filter(Boolean)
        //     }
        //   },
        // })
      }

      // 一時的に全ての答案をnull位置に移動（制約回避）
      await Promise.all(
        moves.map((_, index) =>
          tx.pageImage.update({
            where: { id: moves[index].fileId },
            data: {
              studentId: null,
              // TODO: Handle temporary pageNumber assignment in new schema
            },
          })
        )
      )

      // 各答案を最終位置に移動
      await Promise.all(
        moves.map((move) =>
          tx.pageImage.update({
            where: { id: move.fileId },
            data: {
              studentId: move.finalStudentId,
              // TODO: Handle pageNumber assignment in new schema - might need to move to different ProjectPage
            },
          })
        )
      )

      if (withScoring && allQuestionScores.length > 0) {
        // 採点データを復元（答案IDは変更せず、位置情報が変わっただけ）
        await tx.questionScore.createMany({
          data: [], // TODO: Update for new schema
          // allQuestionScores.map((score) => ({
          //   cropRegionId: score.cropRegionId,
          //   studentId: score.studentId,
          //   status: score.status,
          //   scoredByUserId: score.scoredByUserId,
          // })),
        })
      }

      return { success: true }
    })

    return result
  } catch (error) {
    console.error("Error in batch placement update:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "一括配置変更に失敗しました",
    }
  }
}

/**
 * 2つの答案の配置を交換（採点情報も一緒に入れ替え）
 */
export async function swapStudentAnswerPlacementsWithScoring(
  answerSheetId1: string,
  answerSheetId2: string
) {
  try {
    // トランザクション内で答案交換を実行
    const result = await prisma.$transaction(async (tx) => {
      // 2つの答案の現在の配置情報を取得
      const [answerSheet1, answerSheet2] = await Promise.all([
        tx.pageImage.findUnique({
          where: { id: answerSheetId1 },
          select: {
            studentId: true,
            projectPage: {
              select: {
                pageNumber: true,
                projectId: true,
              },
            },
          },
        }),
        tx.pageImage.findUnique({
          where: { id: answerSheetId2 },
          select: {
            studentId: true,
            projectPage: {
              select: {
                pageNumber: true,
                projectId: true,
              },
            },
          },
        }),
      ])

      if (!answerSheet1 || !answerSheet2) {
        throw new Error("答案が見つかりません")
      }

      // 両方の答案に関連する採点データを取得
      // TODO: QuestionScore queries need to be updated for new schema
      const [questionScores1, questionScores2] = [[], []] // await Promise.all([
      //   tx.questionScore.findMany({
      //     where: { studentId: answerSheet1.studentId },
      //   }),
      //   tx.questionScore.findMany({
      //     where: { studentId: answerSheet2.studentId },
      //   }),
      // ])

      // TODO: Score deletion needs to be updated for new schema
      // 採点データを一時的に削除（制約回避のため）
      // await Promise.all([
      //   tx.questionScore.deleteMany({
      //     where: { studentId: answerSheet1.studentId },
      //   }),
      //   tx.questionScore.deleteMany({
      //     where: { studentId: answerSheet2.studentId },
      //   }),
      // ])

      // 一時的にanswerSheet1をnull配置に移動（制約回避）
      await tx.pageImage.update({
        where: { id: answerSheetId1 },
        data: {
          studentId: null,
          // TODO: Handle page swapping in new schema - might need to recreate PageImage in different ProjectPage
        },
      })

      // answerSheet2をanswerSheet1の元の位置に移動
      await tx.pageImage.update({
        where: { id: answerSheetId2 },
        data: {
          studentId: answerSheet1.studentId,
          // TODO: Handle pageNumber in new schema
        },
      })

      // answerSheet1をanswerSheet2の元の位置に移動
      await tx.pageImage.update({
        where: { id: answerSheetId1 },
        data: {
          studentId: answerSheet2.studentId,
          // TODO: Handle pageNumber in new schema
        },
      })

      // 採点データを入れ替えて復元
      // TODO: Score migration needs to be updated for new schema
      // answerSheet1の採点データをanswerSheet2に移行
      // if (questionScores1.length > 0) {
      //   await tx.questionScore.createMany({
      //     data: questionScores1.map((score) => ({
      //       cropRegionId: score.cropRegionId,
      //       studentId: answerSheet2.studentId,
      //       status: score.status,
      //       scoredByUserId: score.scoredByUserId,
      //     })),
      //   })
      // }

      // answerSheet2の採点データをanswerSheet1に移行
      // if (questionScores2.length > 0) {
      //   await tx.questionScore.createMany({
      //     data: questionScores2.map((score) => ({
      //       cropRegionId: score.cropRegionId,
      //       studentId: answerSheet1.studentId,
      //       status: score.status,
      //       scoredByUserId: score.scoredByUserId,
      //     })),
      //   })
      // }

      // 更新後の答案情報を取得
      const [updatedAnswerSheet1, updatedAnswerSheet2] = await Promise.all([
        tx.pageImage.findUnique({
          where: { id: answerSheetId1 },
          include: {
            student: {
              include: {
                projectStudents: {
                  where: { projectId: answerSheet1.projectPage.projectId },
                  select: { customOrder: true },
                },
              },
            },
            projectPage: {
              include: {
                project: true,
              },
            },
            // TODO: questionScores would need to be fetched separately in new schema
          },
        }),
        tx.pageImage.findUnique({
          where: { id: answerSheetId2 },
          include: {
            student: {
              include: {
                projectStudents: {
                  where: { projectId: answerSheet2.projectPage.projectId },
                  select: { customOrder: true },
                },
              },
            },
            projectPage: {
              include: {
                project: true,
              },
            },
            // TODO: questionScores would need to be fetched separately in new schema
          },
        }),
      ])

      return { updatedAnswerSheet1, updatedAnswerSheet2 }
    })

    return {
      success: true,
      answerSheets: [result.updatedAnswerSheet1, result.updatedAnswerSheet2],
    }
  } catch (error) {
    console.error("Error swapping answer sheet placements with scoring:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "採点情報込み答案配置交換に失敗しました",
    }
  }
}
