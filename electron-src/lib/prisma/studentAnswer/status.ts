/**
 * 答案のステータス管理
 * - 欠席状態の設定など
 *
 * 注: 欠席状態はExamStudent.statusで管理されるため、
 * StudentAnswerImage自体には欠席フラグはない。
 * この関数は互換性のために残されている。
 */
import prisma from "../client"

/**
 * 答案の欠席状態を設定
 *
 * 注: 実際の欠席状態はExamStudent.statusで管理される。
 * この関数は答案情報の取得のみを行い、欠席フラグは別途
 * ExamStudentの更新で設定する必要がある。
 */
export async function setStudentAnswerAbsent(
  answerSheetId: string,
  _isAbsent: boolean
) {
  try {
    // StudentAnswerImageには欠席フラグがないため、
    // 答案情報の取得のみを行う
    const answerSheet = await prisma.studentAnswerImage.findUnique({
      where: { id: answerSheetId },
      include: {
        student: true,
        examPage: {
          include: {
            exam: true,
          },
        },
      },
    })

    if (!answerSheet) {
      throw new Error("答案が見つかりません")
    }

    // 欠席状態はExamStudent.statusで設定する必要がある
    // ここでは答案情報のみを返す
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
