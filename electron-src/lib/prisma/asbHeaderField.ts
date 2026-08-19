/**
 * ヘッダー項目（AsbHeaderField）の書き込み。
 *
 * 解答用紙の上端に並ぶ氏名欄・点数欄などの1件ずつ。**この実体が持つ列はここだけが
 * 知っている。** 定義まるごとの保存（{@link ../prisma/asbDefinitionReplace}）も、
 * 1件ずつの書き込みも同じ関数を通す。
 */

import type { AsbHeaderField, Prisma } from "@prisma/client"

import type { HeaderFieldDefinition } from "../../../src/types/answerSheetDefinition.types"
import { writeRow } from "./rowDiff"

/**
 * ヘッダー項目1件の列。
 *
 * `order` は並びの位置で、呼び出し側が決める（{@link ../../../docs/asb-ipc-split-plan}
 * §4.2 — 作成と削除は main、並べ替えは renderer）。
 */
function asbHeaderFieldRow(
  definitionId: string,
  headerField: HeaderFieldDefinition,
  order: number
) {
  return {
    definitionId,
    type: headerField.type ?? "field",
    label: headerField.label,
    widthMm: headerField.widthMm,
    heightMm: headerField.heightMm,
    gridCount: headerField.gridCount,
    lineStyle: headerField.lineStyle,
    lineWidth: headerField.lineWidth,
    order,
    fontSize: headerField.fontSize ?? null,
    linkedRegionType: headerField.linkedRegionType ?? null,
  }
}

/** 無ければ作り、変わっていれば更新する。書いたら `true` */
export async function upsertAsbHeaderField(
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
