/**
 * ヘッダー項目（AsbHeaderField）の書き込み。
 *
 * 解答用紙の上端に並ぶ氏名欄・点数欄などの1件ずつ。**この実体が持つ列はここだけが
 * 知っている。** 定義まるごとの置き換え（{@link ../prisma/asbDefinitionReplace}）も、
 * 1件ずつの書き込みも同じ関数を通す。
 */

import type { AsbHeaderField, Prisma } from "@prisma/client"

import type {
  AsbHeaderFieldAttributes,
  HeaderFieldDefinition,
} from "../../../src/types/answerSheetDefinition.types"
import { writeAsbDefinitionContent } from "./asbDefinitionWrite"
import { updateRowIfChanged, writeRow } from "./rowDiff"
import { sortRowsByIds, writeRowOrders } from "./rowOrder"

/**
 * ヘッダー項目1件の属性の列。
 *
 * 親（`definitionId`）と並びの位置（`order`）は属性ではないので含まない。どちらも
 * 決めるのは足す・消す・並べ替えるという別の操作で、属性の更新では動かさない。
 */
function asbHeaderFieldColumns(headerField: AsbHeaderFieldAttributes) {
  return {
    type: headerField.type ?? "field",
    label: headerField.label,
    widthMm: headerField.widthMm,
    heightMm: headerField.heightMm,
    gridCount: headerField.gridCount,
    lineStyle: headerField.lineStyle,
    lineWidth: headerField.lineWidth,
    fontSize: headerField.fontSize ?? null,
    linkedRegionType: headerField.linkedRegionType ?? null,
  }
}

/** ヘッダー項目1件の行まるごと（親と位置を含む） */
function asbHeaderFieldRow(
  definitionId: string,
  headerField: AsbHeaderFieldAttributes,
  order: number
) {
  return {
    definitionId,
    order,
    ...asbHeaderFieldColumns(headerField),
  }
}

/** 無ければ作り、変わっていれば更新する。書いたら `true` */
export async function writeAsbHeaderField(
  tx: Prisma.TransactionClient,
  definitionId: string,
  headerField: HeaderFieldDefinition,
  order: number,
  existing: AsbHeaderField | undefined
): Promise<boolean> {
  const data = asbHeaderFieldRow(definitionId, headerField, order)
  return writeRow(
    existing,
    data,
    () => tx.asbHeaderField.create({ data: { id: headerField.id, ...data } }),
    () => tx.asbHeaderField.update({ where: { id: headerField.id }, data })
  )
}

/** 残す id 以外を消す。消したら `true` */
export async function deleteRemovedAsbHeaderFields(
  tx: Prisma.TransactionClient,
  definitionId: string,
  survivingIds: string[]
): Promise<boolean> {
  const { count } = await tx.asbHeaderField.deleteMany({
    where: { definitionId, id: { notIn: survivingIds } },
  })
  return count > 0
}

// =============================================================================
// 1件ずつの書き込み（IPC から）
// =============================================================================

/** 末尾に1件足す。位置は main が決める（既存の数がそのまま次の位置） */
export async function createAsbHeaderField(
  definitionId: string,
  headerField: HeaderFieldDefinition
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const order = await tx.asbHeaderField.count({ where: { definitionId } })
    const data = asbHeaderFieldRow(definitionId, headerField, order)
    await tx.asbHeaderField.create({ data: { id: headerField.id, ...data } })
    return true
  })
}

/** 属性を書き換える。親も位置も動かさない */
export async function updateAsbHeaderField(
  definitionId: string,
  headerFieldId: string,
  attributes: AsbHeaderFieldAttributes
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const existing = await tx.asbHeaderField.findUnique({
      where: { id: headerFieldId },
    })
    if (!existing) throw new Error("ヘッダー項目が見つかりません")
    const data = asbHeaderFieldColumns(attributes)
    return updateRowIfChanged(existing, data, () =>
      tx.asbHeaderField.update({ where: { id: headerFieldId }, data })
    )
  })
}

/** 1件消し、残りの並びを詰める */
export async function deleteAsbHeaderField(
  definitionId: string,
  headerFieldId: string
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    await tx.asbHeaderField.delete({ where: { id: headerFieldId } })
    const remaining = await tx.asbHeaderField.findMany({
      where: { definitionId },
      orderBy: { order: "asc" },
    })
    await writeRowOrders(remaining, (id, order) =>
      tx.asbHeaderField.update({ where: { id }, data: { order } })
    )
    return true
  })
}

/** 渡された並びのとおりに位置を振り直す */
export async function reorderAsbHeaderFields(
  definitionId: string,
  orderedIds: string[]
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const rows = await tx.asbHeaderField.findMany({
      where: { definitionId },
      orderBy: { order: "asc" },
    })
    return writeRowOrders(sortRowsByIds(rows, orderedIds), (id, order) =>
      tx.asbHeaderField.update({ where: { id }, data: { order } })
    )
  })
}
