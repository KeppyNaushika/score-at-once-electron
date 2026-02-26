/**
 * 答案の一括操作
 * - 複数答案の一括配置変更
 * - 2つの答案の配置交換（採点情報込み）
 */
import type { QuestionScore } from "@prisma/client"

import prisma from "../client"

/**
 * 複数の答案の配置を一括で変更（採点情報の移行も対応）
 *
 * @param moves - 移動情報の配列（ファイルID、移動先生徒ID、ページ番号）
 * @param withScoring - 採点情報も一緒に移行するかどうか
 * @returns 成功/失敗結果
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
          tx.studentAnswerImage.findUnique({
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
        // 全ての採点データを取得（studentIdベース）
        const studentIds = moves
          .map((m) => m.finalStudentId)
          .filter((id): id is string => id !== null)
        if (studentIds.length > 0) {
          allQuestionScores = await tx.questionScore.findMany({
            where: {
              studentId: { in: studentIds },
            },
          })

          // 一時的に採点データを削除（制約回避）
          await tx.questionScore.deleteMany({
            where: {
              studentId: { in: studentIds },
            },
          })
        }
      }

      // studentIdがnullの移動はStudentAnswerImageでは不可能なので、
      // finalStudentIdがnullの場合は削除として扱う
      const deleteMoves = moves.filter((m) => m.finalStudentId === null)
      const updateMoves = moves.filter((m) => m.finalStudentId !== null)

      // nullに設定される答案を削除
      if (deleteMoves.length > 0) {
        await tx.studentAnswerImage.deleteMany({
          where: {
            id: { in: deleteMoves.map((m) => m.fileId) },
          },
        })
      }

      // @@unique([projectPageId, studentId])制約回避のため2段階更新
      // Step 1: 全ての対象を一時IDに設定（制約衝突を回避）
      const tempPrefix = `__TEMP_BATCH_${Date.now()}_`
      await Promise.all(
        updateMoves.map((move, index) =>
          tx.studentAnswerImage.update({
            where: { id: move.fileId },
            data: {
              studentId: `${tempPrefix}${index}`,
            },
          })
        )
      )

      // Step 2: 最終位置に移動
      await Promise.all(
        updateMoves.map((move) =>
          tx.studentAnswerImage.update({
            where: { id: move.fileId },
            data: {
              studentId: move.finalStudentId!,
            },
          })
        )
      )

      if (withScoring && allQuestionScores.length > 0) {
        // 採点データを復元
        await tx.questionScore.createMany({
          data: allQuestionScores.map((score) => ({
            cropRegionId: score.cropRegionId,
            studentId: score.studentId,
            status: score.status,
            partialScore: score.partialScore,
            userId: score.userId,
          })),
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
 *
 * @param answerSheetId1 - 交換する1つ目の答案ID
 * @param answerSheetId2 - 交換する2つ目の答案ID
 * @returns 成功時は更新後の答案情報、失敗時はエラー情報
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
        tx.studentAnswerImage.findUnique({
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
        tx.studentAnswerImage.findUnique({
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

      // 採点データを取得
      const [questionScores1, questionScores2] = await Promise.all([
        tx.questionScore.findMany({
          where: { studentId: answerSheet1.studentId },
        }),
        tx.questionScore.findMany({
          where: { studentId: answerSheet2.studentId },
        }),
      ])

      // 採点データを一時的に削除（制約回避のため）
      await Promise.all([
        tx.questionScore.deleteMany({
          where: { studentId: answerSheet1.studentId },
        }),
        tx.questionScore.deleteMany({
          where: { studentId: answerSheet2.studentId },
        }),
      ])

      // StudentAnswerImageのstudentIdを交換
      // @@unique([projectPageId, studentId])制約回避のため一時ID方式で3段階更新
      const tempStudentId = `__TEMP_SWAP_${Date.now()}`

      // Step 1: file_1 → 一時ID
      await tx.studentAnswerImage.update({
        where: { id: answerSheetId1 },
        data: { studentId: tempStudentId },
      })

      // Step 2: file_2 → file_1の元のstudentId
      await tx.studentAnswerImage.update({
        where: { id: answerSheetId2 },
        data: { studentId: answerSheet1.studentId },
      })

      // Step 3: file_1（一時ID） → file_2の元のstudentId
      await tx.studentAnswerImage.update({
        where: { id: answerSheetId1 },
        data: { studentId: answerSheet2.studentId },
      })

      // 採点データを入れ替えて復元
      if (questionScores1.length > 0) {
        await tx.questionScore.createMany({
          data: questionScores1.map((score) => ({
            cropRegionId: score.cropRegionId,
            studentId: answerSheet2.studentId,
            status: score.status,
            partialScore: score.partialScore,
            userId: score.userId,
          })),
        })
      }

      if (questionScores2.length > 0) {
        await tx.questionScore.createMany({
          data: questionScores2.map((score) => ({
            cropRegionId: score.cropRegionId,
            studentId: answerSheet1.studentId,
            status: score.status,
            partialScore: score.partialScore,
            userId: score.userId,
          })),
        })
      }

      // 更新後の答案情報を取得
      const [updatedAnswerSheet1, updatedAnswerSheet2] = await Promise.all([
        tx.studentAnswerImage.findUnique({
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
          },
        }),
        tx.studentAnswerImage.findUnique({
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
