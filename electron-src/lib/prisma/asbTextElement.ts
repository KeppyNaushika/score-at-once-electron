/**
 * セルの中のテキスト要素（AsbTextElement）の書き込み。
 *
 * **この実体が持つ列を知っているのはここだけ。** 属するのは小問か枝問のどちらかで、
 * 親の指し方はセルの中身に共通（`asbCellContents.ts`）。
 *
 * `tx` を先に取るものは木を書く側、`definitionId` を先に取るものが IPC の口。
 */

import type { AsbTextElement, Prisma } from "@prisma/client"

import type {
  AsbCellParent,
  AsbTextElementAttributes,
  CellTextElement,
} from "../../../src/types/answerSheetDefinition.types"
import { cellOf, inDefinitionCells } from "./asbCellContents"
import { writeAsbDefinitionContent } from "./asbDefinitionWrite"
import { updateRowIfChanged, writeRow } from "./rowDiff"
import { writeRowOrders } from "./rowOrder"

function asbTextElementColumns(textElement: AsbTextElementAttributes) {
  return {
    text: textElement.text,
    fontSize: textElement.fontSize,
    horizontalAlign: textElement.horizontalAlign,
    verticalAlign: textElement.verticalAlign,
  }
}

function asbTextElementRow(
  parent: AsbCellParent,
  textElement: AsbTextElementAttributes,
  order: number
) {
  return { ...parent, order, ...asbTextElementColumns(textElement) }
}

/** 無ければ作り、変わっていれば更新する。書いたら `true` */
export async function writeAsbTextElement(
  tx: Prisma.TransactionClient,
  parent: AsbCellParent,
  textElement: CellTextElement,
  order: number,
  existing: AsbTextElement | undefined
): Promise<boolean> {
  const data = asbTextElementRow(parent, textElement, order)
  return writeRow(
    existing,
    data,
    () => tx.asbTextElement.create({ data: { id: textElement.id, ...data } }),
    () => tx.asbTextElement.update({ where: { id: textElement.id }, data })
  )
}

/** 残す id 以外を消す。消したら `true` */
export async function deleteRemovedAsbTextElements(
  tx: Prisma.TransactionClient,
  definitionId: string,
  survivingIds: string[]
): Promise<boolean> {
  const { count } = await tx.asbTextElement.deleteMany({
    where: {
      OR: inDefinitionCells(definitionId),
      id: { notIn: survivingIds },
    },
  })
  return count > 0
}

// =============================================================================
// 1件ずつの書き込み（IPC から）
// =============================================================================

/** セルの末尾に1件足す */
export async function createAsbTextElement(
  definitionId: string,
  parent: AsbCellParent,
  textElement: CellTextElement
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const order = await tx.asbTextElement.count({ where: parent })
    const data = asbTextElementRow(parent, textElement, order)
    await tx.asbTextElement.create({ data: { id: textElement.id, ...data } })
    return true
  })
}

export async function updateAsbTextElement(
  definitionId: string,
  textElementId: string,
  attributes: AsbTextElementAttributes
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const existing = await tx.asbTextElement.findUnique({
      where: { id: textElementId },
    })
    if (!existing) throw new Error("テキスト要素が見つかりません")
    const data = asbTextElementColumns(attributes)
    return updateRowIfChanged(existing, data, () =>
      tx.asbTextElement.update({ where: { id: textElementId }, data })
    )
  })
}

/** 1件消し、同じセルに残った要素の並びを詰める */
export async function deleteAsbTextElement(
  definitionId: string,
  textElementId: string
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const removed = await tx.asbTextElement.delete({
      where: { id: textElementId },
    })
    const remaining = await tx.asbTextElement.findMany({
      where: cellOf(removed),
      orderBy: { order: "asc" },
    })
    await writeRowOrders(remaining, (id, order) =>
      tx.asbTextElement.update({ where: { id }, data: { order } })
    )
    return true
  })
}
