/**
 * 文字位置マーカー（AsbCharGuide）の書き込み。
 *
 * 原稿用紙の「N文字目」に紐づく数字ガイドと区切り罫線。小問だけが持つ。
 */

import type { AsbCharGuide, Prisma } from "@prisma/client"

import type {
  AsbCharGuideAttributes,
  ManuscriptCharGuide,
} from "../../../src/types/answerSheetDefinition.types"
import { writeAsbDefinitionContent } from "./asbDefinitionWrite"
import { updateRowIfChanged, writeRow } from "./rowDiff"
import { writeRowOrders } from "./rowOrder"

function asbCharGuideColumns(charGuide: AsbCharGuideAttributes) {
  return {
    atChar: charGuide.atChar,
    label: charGuide.label,
    boundary: charGuide.boundary ?? null,
    boundaryWidth: charGuide.boundaryWidth ?? null,
    boundaryDashRatio: charGuide.boundaryDashRatio ?? null,
    boundaryGapRatio: charGuide.boundaryGapRatio ?? null,
  }
}

function asbCharGuideRow(
  subQuestionId: string,
  charGuide: AsbCharGuideAttributes,
  order: number
) {
  return { subQuestionId, order, ...asbCharGuideColumns(charGuide) }
}

export async function writeAsbCharGuide(
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

/** 小問が持つ文字位置マーカーを、木の並びのとおりに書く */
export async function writeAsbCharGuides(
  tx: Prisma.TransactionClient,
  subQuestionId: string,
  charGuides: ManuscriptCharGuide[],
  current?: ReadonlyMap<string, AsbCharGuide>
): Promise<boolean> {
  let changed = false
  for (const [order, charGuide] of charGuides.entries()) {
    const wrote = await writeAsbCharGuide(
      tx,
      subQuestionId,
      charGuide,
      order,
      current?.get(charGuide.id)
    )
    if (wrote) changed = true
  }
  return changed
}

// =============================================================================
// 1件ずつの書き込み（IPC から）
// =============================================================================

/** 末尾に1件足す */
export async function createAsbCharGuide(
  definitionId: string,
  subQuestionId: string,
  charGuide: ManuscriptCharGuide
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const order = await tx.asbCharGuide.count({ where: { subQuestionId } })
    const data = asbCharGuideRow(subQuestionId, charGuide, order)
    await tx.asbCharGuide.create({ data: { id: charGuide.id, ...data } })
    return true
  })
}

export async function updateAsbCharGuide(
  definitionId: string,
  charGuideId: string,
  attributes: AsbCharGuideAttributes
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const existing = await tx.asbCharGuide.findUnique({
      where: { id: charGuideId },
    })
    if (!existing) throw new Error("文字位置マーカーが見つかりません")
    const data = asbCharGuideColumns(attributes)
    return updateRowIfChanged(existing, data, () =>
      tx.asbCharGuide.update({ where: { id: charGuideId }, data })
    )
  })
}

/** 1件消し、同じ小問に残ったマーカーの並びを詰める */
export async function deleteAsbCharGuide(
  definitionId: string,
  charGuideId: string
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const removed = await tx.asbCharGuide.delete({ where: { id: charGuideId } })
    const remaining = await tx.asbCharGuide.findMany({
      where: { subQuestionId: removed.subQuestionId },
      orderBy: { order: "asc" },
    })
    await writeRowOrders(remaining, (id, order) =>
      tx.asbCharGuide.update({ where: { id }, data: { order } })
    )
    return true
  })
}
