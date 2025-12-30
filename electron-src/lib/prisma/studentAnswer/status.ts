/**
 * 答案のステータス管理
 * - 欠席状態の設定など
 */
import prisma from "../client"

/**
 * 答案の欠席状態を設定
 */
export async function setStudentAnswerAbsent(
  answerSheetId: string,
  _isAbsent: boolean
) {
  try {
    const answerSheet = await prisma.pageImage.update({
      where: { id: answerSheetId },
      data: {
        // TODO: Handle absent status in the new schema
        // isAbsent functionality needs to be implemented differently
      },
      include: {
        student: true,
        projectPage: {
          include: {
            project: true,
          },
        },
      },
    })

    return { success: true, answerSheet }
  } catch (error) {
    console.error("Error setting answer sheet absent status:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "欠席状態の設定に失敗しました",
    }
  }
}
