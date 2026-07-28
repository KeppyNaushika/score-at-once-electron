import prisma from "./client"

export interface GradingDataInfo {
  hasData: boolean
  answerSheetCount: number
  questionScoreCount: number
  scoreDecisionCount: number
  compoundAnswerScoreCount: number
  returnSnapshotCount: number
  totalGradingItems: number
}

/**
 * 指定された生徒が特定の試験で採点データを持っているかチェック。
 *
 * **数える範囲は削除で消える範囲と一致させること。** 生徒を試験から外すと
 * ExamStudent の cascade で採点層5テーブルがすべて消えるので、ここで数え漏らすと
 * 削除確認モーダルが「採点データがないため安全に削除できます」と表示したまま
 * 取り消せない破棄を実行してしまう（例: OMR の複合回答だけが入っている生徒）。
 */
export const checkGradingDataForStudent = async (
  examId: string,
  studentId: string
): Promise<GradingDataInfo> => {
  try {
    const examStudent = { examId, studentId }
    const [
      answerSheetCount,
      questionScoreCount,
      scoreDecisionCount,
      compoundAnswerScoreCount,
      returnSnapshotCount,
    ] = await Promise.all([
      prisma.studentAnswerImage.count({ where: { examStudent } }),
      prisma.questionScore.count({ where: { examStudent } }),
      prisma.scoreDecision.count({ where: { examStudent } }),
      prisma.compoundAnswerScore.count({ where: { examStudent } }),
      prisma.returnSnapshot.count({ where: { examStudent } }),
    ])

    const totalGradingItems =
      answerSheetCount +
      questionScoreCount +
      scoreDecisionCount +
      compoundAnswerScoreCount +
      returnSnapshotCount
    const hasData = totalGradingItems > 0

    return {
      hasData,
      answerSheetCount,
      questionScoreCount,
      scoreDecisionCount,
      compoundAnswerScoreCount,
      returnSnapshotCount,
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
