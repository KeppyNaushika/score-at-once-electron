/**
 * 文字位置マーカー（AsbCharGuide）の書き込み。
 *
 * 原稿用紙の「N文字目」に紐づく数字ガイドと区切り罫線。小問だけが持つ。
 */

import type { AsbCharGuide, Prisma } from "@prisma/client"

import type { ManuscriptCharGuide } from "../../../src/types/answerSheetDefinition.types"
import { writeRow } from "./rowDiff"

export function asbCharGuideRow(
  subQuestionId: string,
  charGuide: ManuscriptCharGuide,
  order: number
) {
  return {
    subQuestionId,
    order,
    atChar: charGuide.atChar,
    label: charGuide.label,
    boundary: charGuide.boundary ?? null,
    boundaryWidth: charGuide.boundaryWidth ?? null,
    boundaryDashRatio: charGuide.boundaryDashRatio ?? null,
    boundaryGapRatio: charGuide.boundaryGapRatio ?? null,
  }
}

export async function upsertAsbCharGuide(
  tx: Prisma.TransactionClient,
  subQuestionId: string,
  charGuide: ManuscriptCharGuide,
  order: number,
  existing: AsbCharGuide | undefined
): Promise<boolean> {
  const data = asbCharGuideRow(subQuestionId, charGuide, order)
  return writeRow(
    existing,
    data,
    () => tx.asbCharGuide.create({ data: { id: charGuide.id, ...data } }),
    () => tx.asbCharGuide.update({ where: { id: charGuide.id }, data })
  )
}

export async function deleteRemovedAsbCharGuides(
  tx: Prisma.TransactionClient,
  definitionId: string,
  survivingIds: string[]
): Promise<boolean> {
  const { count } = await tx.asbCharGuide.deleteMany({
    where: {
      subQuestion: { majorQuestion: { definitionId } },
      id: { notIn: survivingIds },
    },
  })
  return count > 0
}
