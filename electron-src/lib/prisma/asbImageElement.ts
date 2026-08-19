/**
 * セルの中の画像要素（AsbImageElement）の書き込み。
 *
 * **この実体が持つ列を知っているのはここだけ。** 画像の実体はファイルとして data/ に
 * 置かれ、ここが持つのはその相対パスと見せ方だけ。
 *
 * `tx` を先に取るものは木を書く側、`definitionId` を先に取るものが IPC の口。
 */

import type { AsbImageElement, Prisma } from "@prisma/client"

import type {
  AsbCellParent,
  AsbImageElementAttributes,
  CellImageElement,
} from "../../../src/types/answerSheetDefinition.types"
import { cellOf, inDefinitionCells } from "./asbCellContents"
import { writeAsbDefinitionContent } from "./asbDefinitionWrite"
import { updateRowIfChanged, writeRow } from "./rowDiff"
import { writeRowOrders } from "./rowOrder"

function asbImageElementColumns(imageElement: AsbImageElementAttributes) {
  return {
    imagePath: imageElement.imagePath,
    originalName: imageElement.originalName,
    objectFit: imageElement.objectFit,
    horizontalAlign: imageElement.horizontalAlign,
    verticalAlign: imageElement.verticalAlign,
    opacity: imageElement.opacity,
    visibility: imageElement.visibility ?? "both",
  }
}

function asbImageElementRow(
  parent: AsbCellParent,
  imageElement: AsbImageElementAttributes,
  order: number
) {
  return { ...parent, order, ...asbImageElementColumns(imageElement) }
}

/** 無ければ作り、変わっていれば更新する。書いたら `true` */
export async function writeAsbImageElement(
  tx: Prisma.TransactionClient,
  parent: AsbCellParent,
  imageElement: CellImageElement,
  order: number,
  existing: AsbImageElement | undefined
): Promise<boolean> {
  const data = asbImageElementRow(parent, imageElement, order)
  return writeRow(
    existing,
    data,
    () => tx.asbImageElement.create({ data: { id: imageElement.id, ...data } }),
    () => tx.asbImageElement.update({ where: { id: imageElement.id }, data })
  )
}

/** 残す id 以外を消す。消したら `true` */
export async function deleteRemovedAsbImageElements(
  tx: Prisma.TransactionClient,
  definitionId: string,
  survivingIds: string[]
): Promise<boolean> {
  const { count } = await tx.asbImageElement.deleteMany({
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
export async function createAsbImageElement(
  definitionId: string,
  parent: AsbCellParent,
  imageElement: CellImageElement
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const order = await tx.asbImageElement.count({ where: parent })
    const data = asbImageElementRow(parent, imageElement, order)
    await tx.asbImageElement.create({ data: { id: imageElement.id, ...data } })
    return true
  })
}

export async function updateAsbImageElement(
  definitionId: string,
  imageElementId: string,
  attributes: AsbImageElementAttributes
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const existing = await tx.asbImageElement.findUnique({
      where: { id: imageElementId },
    })
    if (!existing) throw new Error("画像要素が見つかりません")
    const data = asbImageElementColumns(attributes)
    return updateRowIfChanged(existing, data, () =>
      tx.asbImageElement.update({ where: { id: imageElementId }, data })
    )
  })
}

/** 1件消し、同じセルに残った要素の並びを詰める */
export async function deleteAsbImageElement(
  definitionId: string,
  imageElementId: string
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const removed = await tx.asbImageElement.delete({
      where: { id: imageElementId },
    })
    const remaining = await tx.asbImageElement.findMany({
      where: cellOf(removed),
      orderBy: { order: "asc" },
    })
    await writeRowOrders(remaining, (id, order) =>
      tx.asbImageElement.update({ where: { id }, data: { order } })
    )
    return true
  })
}
