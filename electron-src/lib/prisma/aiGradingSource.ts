/**
 * AI 採点で送るもの・添えるものの読み取り（答案画像の行、改訂に添える採点）。
 *
 * 画像そのものは試験のフォルダにあり、ここで返すのは行（パス）だけ。切り出しは
 * `aiGrading/answerImage.ts` が行う。
 */

import prisma from "./client"

/**
 * 設問（採点領域）を、ページと答案画像の行の木で返す。
 *
 * @param examStudentIds 渡したら、その答案の画像だけに絞る。省くとページの全答案
 */
export async function getCropRegionWithAnswerImages(
  cropRegionId: string,
  examStudentIds?: readonly string[]
) {
  return prisma.cropRegion.findUnique({
    where: { id: cropRegionId },
    include: {
      examPage: {
        include: {
          studentAnswerImages: {
            where: examStudentIds
              ? { examStudentId: { in: [...examStudentIds] } }
              : {},
            orderBy: [{ examStudentId: "asc" }],
          },
        },
      },
    },
  })
}

/** 改訂に添える、教員自身のその設問の採点行 */
export async function listOwnQuestionScores(
  cropRegionId: string,
  userId: string,
  examStudentIds: readonly string[]
) {
  return prisma.questionScore.findMany({
    where: {
      cropRegionId,
      userId,
      examStudentId: { in: [...examStudentIds] },
    },
  })
}

/** 試行（実行とプロンプト付き）を id で */
export async function listAiGradingAttemptsByIds(
  attemptIds: readonly string[]
) {
  return prisma.aiGradingAttempt.findMany({
    where: { id: { in: [...attemptIds] } },
    include: { run: { include: { prompt: true } } },
  })
}
