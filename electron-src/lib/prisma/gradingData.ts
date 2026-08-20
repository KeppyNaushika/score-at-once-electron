import type { Prisma } from "@prisma/client"

import { DELETION_COUNT_NAME } from "@/lib/shared/deletionCountNames"
import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"

import prisma from "./client"

interface GradingDataInfo {
  hasData: boolean
  answerSheetCount: number
  questionScoreCount: number
  scoreDecisionCount: number
  compoundAnswerScoreCount: number
  returnSnapshotCount: number
  totalGradingItems: number
}

/**
 * 生徒1人が特定の試験で持つ採点データを数える。
 *
 * **数える範囲は削除で消える範囲と一致させること。** 生徒を試験から外すと
 * ExamStudent の cascade で採点層5テーブルがすべて消えるので、ここで数え漏らすと
 * 削除確認モーダルが「採点データがないため安全に削除できます」と表示したまま
 * 取り消せない破棄を実行してしまう（例: OMR の複合回答だけが入っている生徒）。
 *
 * 数え直しは削除と同じトランザクションで行うため、client を受け取る。
 */
const countGradingDataForStudent = async (
  client: typeof prisma | Prisma.TransactionClient,
  examId: string,
  studentId: string
): Promise<GradingDataInfo> => {
  const examStudent = { examId, studentId }
  const [
    answerSheetCount,
    questionScoreCount,
    scoreDecisionCount,
    compoundAnswerScoreCount,
    returnSnapshotCount,
  ] = await Promise.all([
    client.studentAnswerImage.count({ where: { examStudent } }),
    client.questionScore.count({ where: { examStudent } }),
    client.scoreDecision.count({ where: { examStudent } }),
    client.compoundAnswerScore.count({ where: { examStudent } }),
    client.returnSnapshot.count({ where: { examStudent } }),
  ])

  const totalGradingItems =
    answerSheetCount +
    questionScoreCount +
    scoreDecisionCount +
    compoundAnswerScoreCount +
    returnSnapshotCount

  return {
    hasData: totalGradingItems > 0,
    answerSheetCount,
    questionScoreCount,
    scoreDecisionCount,
    compoundAnswerScoreCount,
    returnSnapshotCount,
    totalGradingItems,
  }
}

/**
 * 選んだ生徒を試験から外すと巻き添えになる採点データを、削除の確認で見せる形で数える。
 *
 * ここで返した件数を利用者はそのまま画面で見て、同じ配列が削除の要求に添えられて
 * 戻ってくる。main は消す直前に**同じ関数で**数え直して突き合わせる（段階26）。
 * 0件なら項目を返さない（「採点データがないため安全に削除できます」に対応する）。
 */
export const countExamStudentDeletionCounts = async (
  client: typeof prisma | Prisma.TransactionClient,
  examId: string,
  studentIds: string[]
): Promise<ConfirmedDeletionCount[]> => {
  const perStudent = await Promise.all(
    studentIds.map((studentId) =>
      countGradingDataForStudent(client, examId, studentId)
    )
  )
  const totalGradingItems = perStudent.reduce(
    (total, gradingData) => total + gradingData.totalGradingItems,
    0
  )
  if (totalGradingItems === 0) return []
  return [
    {
      countedName: DELETION_COUNT_NAME.gradingData,
      shownCount: totalGradingItems,
    },
  ]
}

/** 上記を確認ダイアログの事前照会として呼ぶ入口（削除の外側なので通常の client） */
export const getExamStudentDeletionCounts = (
  examId: string,
  studentIds: string[]
): Promise<ConfirmedDeletionCount[]> =>
  countExamStudentDeletionCounts(prisma, examId, studentIds)
