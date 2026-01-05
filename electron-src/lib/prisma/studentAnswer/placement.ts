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
    const currentAnswerSheet = await prisma.studentAnswerImage.findUnique({
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

    // StudentAnswerImageではstudentIdは必須
    // nullの場合は削除として扱う
    if (studentId === null) {
      await prisma.studentAnswerImage.delete({
        where: { id: answerSheetId },
      })
      return { success: true, answerSheet: null, deleted: true }
    }

    const answerSheet = await prisma.studentAnswerImage.update({
      where: { id: answerSheetId },
      data: {
        studentId,
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

      // StudentAnswerImageのstudentIdを交換
      await tx.studentAnswerImage.update({
        where: { id: answerSheetId1 },
        data: { studentId: answerSheet2.studentId },
      })

      await tx.studentAnswerImage.update({
        where: { id: answerSheetId2 },
        data: { studentId: answerSheet1.studentId },
      })

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
    console.error("Error swapping answer sheet placements:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "答案の配置交換に失敗しました",
    }
  }
}
