/**
 * 小問（AsbSubQuestion）の書き込み。
 *
 * **この実体が持つ列を知っているのはここだけ。** 原稿用紙は別テーブル（`AsbManuscriptPaper`）
 * になり、セルの中身として枝問と同じ経路を通る。
 *
 * `tx` を先に取るものは木を書く側、`definitionId` を先に取るものが IPC の口
 * （`asbBranchQuestion.ts` と同じ）。
 */

import type { AsbSubQuestion, Prisma } from "@prisma/client"

import type {
  AsbSubQuestionAttributes,
  SubQuestion,
} from "../../../src/types/answerSheetDefinition.types"
import type { CurrentAsbBranchQuestionRows } from "./asbBranchQuestion"
import { writeAsbBranchQuestionTree } from "./asbBranchQuestion"
import { writeAsbCellContents } from "./asbCellContents"
import { writeAsbDefinitionContent } from "./asbDefinitionWrite"
import { updateRowIfChanged, writeRow } from "./rowDiff"
import { sortRowsByIds, writeRowOrders } from "./rowOrder"

/** 小問とその子のうち、既に DB にある行 */
export interface CurrentAsbSubQuestionRows extends CurrentAsbBranchQuestionRows {
  subQuestions: ReadonlyMap<string, AsbSubQuestion>
}

function asbSubQuestionColumns(subQuestion: AsbSubQuestionAttributes) {
  return {
    label: subQuestion.label,
    heightMultiplier: subQuestion.heightMultiplier,
    points: subQuestion.points,
    usesBranchPoints: subQuestion.usesBranchPoints ?? null,
    layoutWidth: subQuestion.layoutWidth ?? null,
    nextPlacement: subQuestion.nextPlacement ?? null,
    goUp: subQuestion.goUp ?? null,
    borderStyleTop: subQuestion.borderStyles?.top ?? null,
    borderStyleBottom: subQuestion.borderStyles?.bottom ?? null,
    borderStyleLeft: subQuestion.borderStyles?.left ?? null,
    borderStyleRight: subQuestion.borderStyles?.right ?? null,
  }
}

function asbSubQuestionRow(
  majorQuestionId: string,
  subQuestion: AsbSubQuestionAttributes,
  order: number
) {
  return {
    majorQuestionId,
    order,
    ...asbSubQuestionColumns(subQuestion),
  }
}

/**
 * 小問と、その下（セルの中身・枝問）をまとめて書く。
 *
 * @returns 1行でも書いたら `true`
 */
export async function writeAsbSubQuestionTree(
  tx: Prisma.TransactionClient,
  majorQuestionId: string,
  subQuestion: SubQuestion,
  order: number,
  current?: CurrentAsbSubQuestionRows
): Promise<boolean> {
  const data = asbSubQuestionRow(majorQuestionId, subQuestion, order)
  let changed = await writeRow(
    current?.subQuestions.get(subQuestion.id),
    data,
    () => tx.asbSubQuestion.create({ data: { id: subQuestion.id, ...data } }),
    () => tx.asbSubQuestion.update({ where: { id: subQuestion.id }, data })
  )
  const mark = (wrote: boolean) => {
    if (wrote) changed = true
  }

  mark(
    await writeAsbCellContents(
      tx,
      { subQuestionId: subQuestion.id },
      subQuestion,
      current
    )
  )
  for (const [
    branchQuestionOrder,
    branchQuestion,
  ] of subQuestion.branchQuestions.entries()) {
    mark(
      await writeAsbBranchQuestionTree(
        tx,
        subQuestion.id,
        branchQuestion,
        branchQuestionOrder,
        current
      )
    )
  }
  return changed
}

/** 残す id 以外を消す。消したら `true` */
export async function deleteRemovedAsbSubQuestions(
  tx: Prisma.TransactionClient,
  definitionId: string,
  survivingIds: string[]
): Promise<boolean> {
  const { count } = await tx.asbSubQuestion.deleteMany({
    where: {
      majorQuestion: { definitionId },
      id: { notIn: survivingIds },
    },
  })
  return count > 0
}

// =============================================================================
// 1件ずつの書き込み（IPC から）
// =============================================================================

/** 大問の末尾に小問を1つ足す */
export async function createAsbSubQuestion(
  definitionId: string,
  majorQuestionId: string,
  subQuestion: SubQuestion
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const order = await tx.asbSubQuestion.count({ where: { majorQuestionId } })
    return writeAsbSubQuestionTree(tx, majorQuestionId, subQuestion, order)
  })
}

export async function updateAsbSubQuestion(
  definitionId: string,
  subQuestionId: string,
  attributes: AsbSubQuestionAttributes
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const existing = await tx.asbSubQuestion.findUnique({
      where: { id: subQuestionId },
    })
    if (!existing) throw new Error("小問が見つかりません")
    const data = asbSubQuestionColumns(attributes)
    return updateRowIfChanged(existing, data, () =>
      tx.asbSubQuestion.update({ where: { id: subQuestionId }, data })
    )
  })
}

/** 1件消し、同じ大問に残った小問の並びを詰める。子は Cascade で消える */
export async function deleteAsbSubQuestion(
  definitionId: string,
  subQuestionId: string
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const removed = await tx.asbSubQuestion.delete({
      where: { id: subQuestionId },
    })
    const remaining = await tx.asbSubQuestion.findMany({
      where: { majorQuestionId: removed.majorQuestionId },
      orderBy: { order: "asc" },
    })
    await writeRowOrders(remaining, (id, order) =>
      tx.asbSubQuestion.update({ where: { id }, data: { order } })
    )
    return true
  })
}

/** 渡された並びのとおりに位置を振り直す */
export async function reorderAsbSubQuestions(
  definitionId: string,
  majorQuestionId: string,
  orderedIds: string[]
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const rows = await tx.asbSubQuestion.findMany({
      where: { majorQuestionId },
      orderBy: { order: "asc" },
    })
    return writeRowOrders(sortRowsByIds(rows, orderedIds), (id, order) =>
      tx.asbSubQuestion.update({ where: { id }, data: { order } })
    )
  })
}
