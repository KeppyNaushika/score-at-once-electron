/**
 * 答案の配置管理
 * - 単一答案の配置更新
 * - 2つの答案の配置交換（採点情報なし）
 */
import prisma from "../client"

/**
 * 答案の配置情報を更新（生徒ID・ページ番号）
 */
export async function updateStudentAnswerPlacement(
  answerSheetId: string,
  studentId: string | null,
  _pageNumber: number
) {
  try {
    // まず現在の答案情報を取得してprojectIdを確認
    const currentAnswerSheet = await prisma.pageImage.findUnique({
      where: { id: answerSheetId },
      select: {
        projectPage: {
          select: {
            projectId: true,
          },
        },
      },
    })

    if (!currentAnswerSheet) {
      throw new Error("答案が見つかりません")
    }

    const answerSheet = await prisma.pageImage.update({
      where: { id: answerSheetId },
      data: {
        studentId,
        // TODO: Handle page changes in the new schema - might need to move to different ProjectPage
      },
      include: {
        student: {
          include: {
            projectStudents: {
              where: { projectId: currentAnswerSheet.projectPage.projectId },
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
    })

    return { success: true, answerSheet }
  } catch (error) {
    console.error("Error updating answer sheet placement:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "答案の配置更新に失敗しました",
    }
  }
}

/**
 * 2つの答案の配置を交換（ユニーク制約を考慮した安全な交換）
 */
export async function swapStudentAnswerPlacements(
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
    console.error("Error swapping answer sheet placements:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "答案の配置交換に失敗しました",
    }
  }
}
