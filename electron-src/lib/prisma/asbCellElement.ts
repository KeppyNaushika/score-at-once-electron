/**
 * セルの中身（AsbTextElement / AsbImageElement）の書き込み。
 *
 * どちらも小問か枝問のどちらかに属する（{@link AsbCellParent}）。DB では別の外部キーに
 * なるので、親の指定を1つの形にまとめて受け取る。
 */

import type { AsbImageElement, AsbTextElement, Prisma } from "@prisma/client"

import type {
  AsbCellParent,
  CellImageElement,
  CellTextElement,
} from "../../../src/types/answerSheetDefinition.types"
import { writeRow } from "./rowDiff"

// =============================================================================
// テキスト要素
// =============================================================================

export function asbTextElementRow(
  parent: AsbCellParent,
  textElement: CellTextElement,
  order: number
) {
  return {
    ...parent,
    text: textElement.text,
    fontSize: textElement.fontSize,
    horizontalAlign: textElement.horizontalAlign,
    verticalAlign: textElement.verticalAlign,
    order,
  }
}

export async function upsertAsbTextElement(
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
// 画像要素
// =============================================================================

export function asbImageElementRow(
  parent: AsbCellParent,
  imageElement: CellImageElement,
  order: number
) {
  return {
    ...parent,
    imagePath: imageElement.imagePath,
    originalName: imageElement.originalName,
    objectFit: imageElement.objectFit,
    horizontalAlign: imageElement.horizontalAlign,
    verticalAlign: imageElement.verticalAlign,
    opacity: imageElement.opacity,
    visibility: imageElement.visibility ?? "both",
    order,
  }
}

export async function upsertAsbImageElement(
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

/** 「この解答用紙のどれかのセルに属する」— 小問の子か、枝問の子か */
export function inDefinitionCells(definitionId: string) {
  return [
    { subQuestion: { majorQuestion: { definitionId } } },
    { branchQuestion: { subQuestion: { majorQuestion: { definitionId } } } },
  ]
}
