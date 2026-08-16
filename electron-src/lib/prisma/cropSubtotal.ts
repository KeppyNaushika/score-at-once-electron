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

/**
 * 設問-小計の紐付けを1件作る（データ整合性を検証する）。
 *
 * かつては「その領域の紐付けを全消し → 作り直し」の2本で1マスの変更を表して
 * いた。マス1つを消しただけで全ての紐付けが一度 DB から消えるので、途中で
 * 落ちれば全滅し、同時に触れば互いの結果を消し合っていた。
 */
export const createCropSubtotal = async (
  data: Prisma.CropSubtotalUncheckedCreateInput
) => {
  const cropRegion = await prisma.cropRegion.findUnique({
    where: { id: data.cropRegionId },
    include: { examPage: true },
  })

  if (!cropRegion) {
    throw new Error(`指定された設問領域が見つかりません: ${data.cropRegionId}`)
  }

  const subtotal = await prisma.subtotal.findUnique({
    where: { id: data.subtotalId },
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
    throw new Error(`指定された小計項目が見つかりません: ${data.subtotalId}`)
  }

  // 小計項目が試験で有効化されているかチェック
  const isSubtotalActiveInExam =
    subtotal.subtotalGroup.examSubtotalGroups.length > 0

  if (!isSubtotalActiveInExam) {
    throw new Error(
      `小計項目「${subtotal.name}」（グループ：${subtotal.subtotalGroup.name}）は、この試験で有効化されていません。先に04-question-groupページで小計点グループを追加してください。`
    )
  }

  return prisma.cropSubtotal.create({ data })
}

/** 設問-小計の紐付けを1件消す */
export const deleteCropSubtotal = async (cropSubtotalId: string) => {
  return prisma.cropSubtotal.delete({
    where: { id: cropSubtotalId },
  })
}

/** 小計点領域に紐づく小計を、設問割り当てまで含めて取得する（得点算出用） */
export const getCropSubtotalsForScoring = async (cropRegionId: string) => {
  return prisma.cropSubtotal.findMany({
    where: { cropRegionId },
    include: cropSubtotalForScoringInclude,
  })
}
