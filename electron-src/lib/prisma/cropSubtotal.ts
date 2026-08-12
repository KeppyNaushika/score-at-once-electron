import type { Prisma } from "@prisma/client"

import prisma from "./client"

/**
 * 設問領域と小計の紐付けの種類。
 *
 * - `QUESTION_ASSIGNMENT`: 設問領域（QUESTION_ANSWER）を小計へ足し込む
 * - `SUBTOTAL_DEFINITION`: 小計欄領域（SUBTOTAL_SCORE）がどの小計を表示するか
 *
 * DB 上は String（SQLite に enum が無い）。書き込む側がこの union を使う。
 */
export type CropSubtotalAssignmentType =
  "QUESTION_ASSIGNMENT" | "SUBTOTAL_DEFINITION"

/**
 * 小計に割り当てられた設問領域（配点と所属試験まで）。
 *
 * 小計点の算出と満点のライブ算出は、どちらもこの行だけを読む。SubtotalGroup は複数の
 * 試験で共有されうるので、どの試験の設問かは `cropRegion.examPage.examId` で判別する。
 */
export const subtotalWithQuestionAssignmentsInclude = {
  cropSubtotals: {
    where: {
      assignmentType: "QUESTION_ASSIGNMENT",
      cropRegion: { type: "QUESTION_ANSWER" },
    },
    include: { cropRegion: { include: { examPage: true } } },
  },
} satisfies Prisma.SubtotalInclude

/**
 * 小計点領域（SUBTOTAL_SCORE）の得点算出に使う形。
 *
 * 紐づく各小計の設問割り当てまで辿るので、小計ごとの追加クエリが要らない。
 * 04-question-group は採点領域に同梱された `cropSubtotals` を読むだけなので、
 * 割り当てグラフを引くのはこの経路だけでよい。
 */
const cropSubtotalForScoringInclude = {
  subtotal: {
    include: {
      subtotalGroup: true,
      ...subtotalWithQuestionAssignmentsInclude,
    },
  },
} satisfies Prisma.CropSubtotalInclude

/** 複数の設問-小計紐付けを一括作成する（各項目のデータ整合性を検証） */
export const createManyCropSubtotals = async (
  data: Prisma.CropSubtotalUncheckedCreateInput[]
) => {
  // 各CropSubtotalについてデータ整合性をチェック
  for (const item of data) {
    const cropRegion = await prisma.cropRegion.findUnique({
      where: { id: item.cropRegionId },
      include: { examPage: true },
    })

    if (!cropRegion) {
      throw new Error(
        `指定された設問領域が見つかりません: ${item.cropRegionId}`
      )
    }

    const subtotal = await prisma.subtotal.findUnique({
      where: { id: item.subtotalId },
      include: {
        subtotalGroup: {
          include: {
            examSubtotalGroups: {
              where: {
                examId: cropRegion.examPage.examId,
              },
            },
          },
        },
      },
    })

    if (!subtotal) {
      throw new Error(`指定された小計項目が見つかりません: ${item.subtotalId}`)
    }

    // 小計項目が試験で有効化されているかチェック
    const isSubtotalActiveInExam =
      subtotal.subtotalGroup.examSubtotalGroups.length > 0

    if (!isSubtotalActiveInExam) {
      throw new Error(
        `小計項目「${subtotal.name}」（グループ：${subtotal.subtotalGroup.name}）は、この試験で有効化されていません。先に04-question-groupページで小計点グループを追加してください。`
      )
    }
  }

  return prisma.cropSubtotal.createMany({
    data,
  })
}

/** 指定した設問領域に紐づく全ての設問-小計紐付けを削除する */
export const deleteCropSubtotalsByCropRegionId = async (
  cropRegionId: string
) => {
  return prisma.cropSubtotal.deleteMany({
    where: { cropRegionId },
  })
}

/** 小計点領域に紐づく小計を、設問割り当てまで含めて取得する（得点算出用） */
export const getCropSubtotalsForScoring = async (cropRegionId: string) => {
  return prisma.cropSubtotal.findMany({
    where: { cropRegionId },
    include: cropSubtotalForScoringInclude,
  })
}
