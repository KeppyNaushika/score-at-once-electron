import prisma from "./client"
import { recordDrawingAnnotationDeletionsForQuestionScores } from "./deletedRecord"

export interface GradingDataInfo {
  hasData: boolean
  answerSheetCount: number
  questionScoreCount: number
  totalGradingItems: number
}

/**
 * 指定された生徒が特定の試験で採点データを持っているかチェック
 */
export const checkGradingDataForStudent = async (
  examId: string,
  studentId: string
): Promise<GradingDataInfo> => {
  try {
    // 答案シート数をカウント
    const answerSheetCount = await prisma.studentAnswerImage.count({
      where: {
        studentId,
        examPage: {
          examId,
        },
      },
    })

    // 設問別採点結果数をカウント
    const questionScoreCount = await prisma.questionScore.count({
      where: {
        studentId,
        cropRegion: {
          examPage: {
            examId,
          },
        },
      },
    })

    const totalGradingItems = answerSheetCount + questionScoreCount
    const hasData = totalGradingItems > 0

    return {
      hasData,
      answerSheetCount,
      questionScoreCount,
      totalGradingItems,
    }
  } catch (error) {
    console.error("Failed to check grading data for student:", error)
    throw error
  }
}

/**
 * 複数の生徒について採点データをまとめてチェック
 */
export const checkGradingDataForStudents = async (
  examId: string,
  studentIds: string[]
): Promise<{
  hasAnyData: boolean
  totalGradingItems: number
  studentData: Record<string, GradingDataInfo>
}> => {
  try {
    const studentData: Record<string, GradingDataInfo> = {}
    let totalGradingItems = 0

    // 各生徒について採点データをチェック
    for (const studentId of studentIds) {
      const gradingInfo = await checkGradingDataForStudent(examId, studentId)
      studentData[studentId] = gradingInfo
      totalGradingItems += gradingInfo.totalGradingItems
    }

    const hasAnyData = totalGradingItems > 0

    return {
      hasAnyData,
      totalGradingItems,
      studentData,
    }
  } catch (error) {
    console.error("Failed to check grading data for students:", error)
    throw error
  }
}

/**
 * 生徒の採点データを完全に削除
 */
export const deleteAllGradingDataForStudent = async (
  examId: string,
  studentId: string
): Promise<void> => {
  try {
    await prisma.$transaction(async (tx) => {
      // cascade削除前にDrawingAnnotationのtombstoneを記録
      const affectedScores = await tx.questionScore.findMany({
        where: {
          studentId,
          cropRegion: { examPage: { examId } },
        },
        select: { id: true },
      })
      if (affectedScores.length > 0) {
        await recordDrawingAnnotationDeletionsForQuestionScores(
          affectedScores.map((s) => s.id),
          { tx }
        )
      }

      // 1. 設問別採点結果を削除
      await tx.questionScore.deleteMany({
        where: {
          studentId,
          cropRegion: {
            examPage: {
              examId,
            },
          },
        },
      })

      // 2. 答案シートを削除
      await tx.studentAnswerImage.deleteMany({
        where: {
          studentId,
          examPage: {
            examId,
          },
        },
      })
    })
  } catch (error) {
    console.error("Failed to delete grading data for student:", error)
    throw error
  }
}
