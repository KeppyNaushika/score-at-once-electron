/**
 * 枝問（AsbBranchQuestion）の書き込み。
 *
 * **この実体が持つ列を知っているのはここだけ。** 定義まるごとの置き換えも、1件ずつの
 * 書き込みも同じ列の組み立てを通る。
 *
 * 関数の形は2種類ある。**`tx` を先に取るものは木を書く側**（バルクと、新しい枝を
 * まとめて入れるところ）で、**`definitionId` を先に取るものが IPC の口**。後者は
 * 担当の確認と解答用紙の更新日時を `writeAsbDefinitionContent` に任せる。
 */

import type { AsbBranchQuestion, Prisma } from "@prisma/client"

import type {
  AsbBranchQuestionAttributes,
  BranchQuestion,
} from "../../../src/types/answerSheetDefinition.types"
import type { CurrentAsbCellRows } from "./asbCellContents"
import { writeAsbCellContents } from "./asbCellContents"
import { writeAsbDefinitionContent } from "./asbDefinitionWrite"
import { updateRowIfChanged, writeRow } from "./rowDiff"
import { sortRowsByIds, writeRowOrders } from "./rowOrder"

/** 枝問とその中身のうち、既に DB にある行 */
export interface CurrentAsbBranchQuestionRows extends CurrentAsbCellRows {
  branchQuestions: ReadonlyMap<string, AsbBranchQuestion>
}

function asbBranchQuestionColumns(branchQuestion: AsbBranchQuestionAttributes) {
  return {
    label: branchQuestion.label,
    heightMultiplier: branchQuestion.heightMultiplier,
    points: branchQuestion.points,
    layoutWidth: branchQuestion.layoutWidth ?? null,
    nextPlacement: branchQuestion.nextPlacement ?? null,
    goUp: branchQuestion.goUp ?? null,
    borderStyleTop: branchQuestion.borderStyles?.top ?? null,
    borderStyleBottom: branchQuestion.borderStyles?.bottom ?? null,
    borderStyleLeft: branchQuestion.borderStyles?.left ?? null,
    borderStyleRight: branchQuestion.borderStyles?.right ?? null,
  }
}

function asbBranchQuestionRow(
  subQuestionId: string,
  branchQuestion: AsbBranchQuestionAttributes,
  order: number
) {
  return {
    subQuestionId,
    order,
    ...asbBranchQuestionColumns(branchQuestion),
  }
}

/**
 * 枝問とその中身（テキスト・画像・OMR設定・原稿用紙）を書く。
 *
 * `current` を渡さないのは新しい枝を入れるときで、その場合はすべて作成になる。
 *
 * @returns 1行でも書いたら `true`
 */
export async function writeAsbBranchQuestionTree(
  tx: Prisma.TransactionClient,
  subQuestionId: string,
  branchQuestion: BranchQuestion,
  order: number,
  current?: CurrentAsbBranchQuestionRows
): Promise<boolean> {
  const data = asbBranchQuestionRow(subQuestionId, branchQuestion, order)
  let changed = await writeRow(
    current?.branchQuestions.get(branchQuestion.id),
    data,
    () =>
      tx.asbBranchQuestion.create({ data: { id: branchQuestion.id, ...data } }),
    () =>
      tx.asbBranchQuestion.update({ where: { id: branchQuestion.id }, data })
  )
  const wroteContents = await writeAsbCellContents(
    tx,
    { branchQuestionId: branchQuestion.id },
    branchQuestion,
    current
  )
  if (wroteContents) changed = true
  return changed
}

/** 残す id 以外を消す。消したら `true` */
export async function deleteRemovedAsbBranchQuestions(
  tx: Prisma.TransactionClient,
  definitionId: string,
  survivingIds: string[]
): Promise<boolean> {
  const { count } = await tx.asbBranchQuestion.deleteMany({
    where: {
      subQuestion: { majorQuestion: { definitionId } },
      id: { notIn: survivingIds },
    },
  })
  return count > 0
}

// =============================================================================
// 1件ずつの書き込み（IPC から）
// =============================================================================

/** 小問の末尾に枝問を1つ足す */
export async function createAsbBranchQuestion(
  definitionId: string,
  subQuestionId: string,
  branchQuestion: BranchQuestion
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const order = await tx.asbBranchQuestion.count({ where: { subQuestionId } })
    return writeAsbBranchQuestionTree(tx, subQuestionId, branchQuestion, order)
  })
}

export async function updateAsbBranchQuestion(
  definitionId: string,
  branchQuestionId: string,
  attributes: AsbBranchQuestionAttributes
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const existing = await tx.asbBranchQuestion.findUnique({
      where: { id: branchQuestionId },
    })
    if (!existing) throw new Error("枝問が見つかりません")
    const data = asbBranchQuestionColumns(attributes)
    return updateRowIfChanged(existing, data, () =>
      tx.asbBranchQuestion.update({ where: { id: branchQuestionId }, data })
    )
  })
}

/** 1件消し、同じ小問に残った枝問の並びを詰める。中身は Cascade で消える */
export async function deleteAsbBranchQuestion(
  definitionId: string,
  branchQuestionId: string
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const removed = await tx.asbBranchQuestion.delete({
      where: { id: branchQuestionId },
    })
    const remaining = await tx.asbBranchQuestion.findMany({
      where: { subQuestionId: removed.subQuestionId },
      orderBy: { order: "asc" },
    })
    await writeRowOrders(remaining, (id, order) =>
      tx.asbBranchQuestion.update({ where: { id }, data: { order } })
    )
    return true
  })
}

/** 渡された並びのとおりに位置を振り直す */
export async function reorderAsbBranchQuestions(
  definitionId: string,
  subQuestionId: string,
  orderedIds: string[]
): Promise<void> {
  await writeAsbDefinitionContent(definitionId, async (tx) => {
    const rows = await tx.asbBranchQuestion.findMany({
      where: { subQuestionId },
      orderBy: { order: "asc" },
    })
    return writeRowOrders(sortRowsByIds(rows, orderedIds), (id, order) =>
      tx.asbBranchQuestion.update({ where: { id }, data: { order } })
    )
  })
}
