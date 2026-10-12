/**
 * AI採点で送るものの読み取り（答案画像の行）。
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
