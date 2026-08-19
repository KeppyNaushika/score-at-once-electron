/**
 * 大問（AsbMajorQuestion）の書き込み。
 *
 * 大問が持つのはラベルと並びの位置だけで、中身は小問以下にある。
 *
 * `tx` を先に取るものは木を書く側、`definitionId` を先に取るものが IPC の口
 * （`asbBranchQuestion.ts` と同じ）。
 */

import type { AsbMajorQuestion, Prisma } from "@prisma/client"

import type {
  AsbMajorQuestionAttributes,
  MajorQuestion,
} from "../../../src/types/answerSheetDefinition.types"
import { writeAsbDefinitionContent } from "./asbDefinitionWrite"
import type { CurrentAsbSubQuestionRows } from "./asbSubQuestion"
import { writeAsbSubQuestionTree } from "./asbSubQuestion"
import { updateRowIfChanged, writeRow } from "./rowDiff"
import { sortRowsByIds, writeRowOrders } from "./rowOrder"

/** 設問3階層とその中身のうち、既に DB にある行 */
interface CurrentAsbQuestionRows extends CurrentAsbSubQuestionRows {
  majorQuestions: ReadonlyMap<string, AsbMajorQuestion>
}

function asbMajorQuestionColumns(majorQuestion: AsbMajorQuestionAttributes) {
  return { label: majorQuestion.label }
}

function asbMajorQuestionRow(
  definitionId: string,
  majorQuestion: AsbMajorQuestionAttributes,
  order: number
) {
  return {
    definitionId,
    order,
    ...asbMajorQuestionColumns(majorQuestion),
  }
}

/**
 * 大問と、その下の小問以下をまとめて書く。
 *
 * @returns 1行でも書いたら `true`
 */
export async function writeAsbMajorQuestionTree(
  tx: Prisma.TransactionClient,
  definitionId: string,
  majorQuestion: MajorQuestion,
  order: number,
  current?: CurrentAsbQuestionRows
): Promise<boolean> {
  const data = asbMajorQuestionRow(definitionId, majorQuestion, order)
  let changed = await writeRow(
    current?.majorQuestions.get(majorQuestion.id),
    data,
    () =>
      tx.asbMajorQuestion.create({ data: { id: majorQuestion.id, ...data } }),
    () => tx.asbMajorQuestion.update({ where: { id: majorQuestion.id }, data })
  )
  for (const [
    subQuestionOrder,
    subQuestion,
  ] of majorQuestion.subQuestions.entries()) {
    const wrote = await writeAsbSubQuestionTree(
      tx,
      majorQuestion.id,
      subQuestion,
      subQuestionOrder,
      current
    )
    if (wrote) changed = true
  }
  return changed
}

/** 残す id 以外を消す。消したら `true` */
export async function deleteRemovedAsbMajorQuestions(
  tx: Prisma.TransactionClient,
  definitionId: string,
  survivingIds: string[]
): Promise<boolean> {
  const { count } = await tx.asbMajorQuestion.deleteMany({
    where: { definitionId, id: { notIn: survivingIds } },
  })
  return count > 0
}

// =============================================================================
// 1件ずつの書き込み（IPC から）
// =============================================================================

/**
 * 末尾に大問を1つ足す。
 *
 * 新しい大問は既定の小問を1つ連れてくる（作るのは画面）。**同じ1つの意図なので、
 * 同じ書き込みで入れる** — 別々の書き込みにすると、途中で失敗したときに小問の無い
 * 大問が残る。
 */
export async function createAsbMajorQuestion(
  definitionId: string,
  majorQuestion: MajorQuestion
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const order = await tx.asbMajorQuestion.count({ where: { definitionId } })
    return writeAsbMajorQuestionTree(tx, definitionId, majorQuestion, order)
  })
}

export async function updateAsbMajorQuestion(
  definitionId: string,
  majorQuestionId: string,
  attributes: AsbMajorQuestionAttributes
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const existing = await tx.asbMajorQuestion.findUnique({
      where: { id: majorQuestionId },
    })
    if (!existing) throw new Error("大問が見つかりません")
    const data = asbMajorQuestionColumns(attributes)
    return updateRowIfChanged(existing, data, () =>
      tx.asbMajorQuestion.update({ where: { id: majorQuestionId }, data })
    )
  })
}

/** 1件消し、残った大問の並びを詰める。子は Cascade で消える */
export async function deleteAsbMajorQuestion(
  definitionId: string,
  majorQuestionId: string
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    await tx.asbMajorQuestion.delete({ where: { id: majorQuestionId } })
    const remaining = await tx.asbMajorQuestion.findMany({
      where: { definitionId },
      orderBy: { order: "asc" },
    })
    await writeRowOrders(remaining, (id, order) =>
      tx.asbMajorQuestion.update({ where: { id }, data: { order } })
    )
    return true
  })
}

/** 渡された並びのとおりに位置を振り直す */
export async function reorderAsbMajorQuestions(
  definitionId: string,
  orderedIds: string[]
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const rows = await tx.asbMajorQuestion.findMany({
      where: { definitionId },
      orderBy: { order: "asc" },
    })
    return writeRowOrders(sortRowsByIds(rows, orderedIds), (id, order) =>
      tx.asbMajorQuestion.update({ where: { id }, data: { order } })
    )
  })
}
