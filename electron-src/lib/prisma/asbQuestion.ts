/**
 * 設問3階層（AsbMajorQuestion / AsbSubQuestion / AsbBranchQuestion）の書き込み。
 *
 * **それぞれが持つ列を知っているのはここだけ。** 定義まるごとの保存
 * （`asbDefinitionReplace.ts`）も、1件ずつの書き込みも同じ関数を通す。
 *
 * 消すときの範囲指定が階層ごとに違うのは、DB 上の親子が
 * 解答用紙 → 大問 → 小問 → 枝問 と繋がっていて、「この解答用紙の中の枝問」を
 * 名指しするには祖先を辿るしかないため。
 */

import type {
  AsbBranchQuestion,
  AsbMajorQuestion,
  AsbSubQuestion,
  Prisma,
} from "@prisma/client"

import type {
  BranchQuestion,
  MajorQuestion,
  SubQuestion,
} from "../../../src/types/answerSheetDefinition.types"
import { writeRow } from "./rowDiff"

// =============================================================================
// 大問
// =============================================================================

function asbMajorQuestionRow(
  definitionId: string,
  majorQuestion: MajorQuestion,
  order: number
) {
  return {
    definitionId,
    label: majorQuestion.label,
    order,
  }
}

export async function upsertAsbMajorQuestion(
  tx: Prisma.TransactionClient,
  definitionId: string,
  majorQuestion: MajorQuestion,
  order: number,
  existing: AsbMajorQuestion | undefined
): Promise<boolean> {
  const data = asbMajorQuestionRow(definitionId, majorQuestion, order)
  return writeRow(
    existing,
    data,
    () =>
      tx.asbMajorQuestion.create({ data: { id: majorQuestion.id, ...data } }),
    () => tx.asbMajorQuestion.update({ where: { id: majorQuestion.id }, data })
  )
}

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
// 小問
// =============================================================================

function asbSubQuestionRow(
  majorQuestionId: string,
  subQuestion: SubQuestion,
  order: number
) {
  return {
    majorQuestionId,
    label: subQuestion.label,
    order,
    heightMultiplier: subQuestion.heightMultiplier,
    points: subQuestion.points,
    usesBranchPoints: subQuestion.usesBranchPoints ?? null,
    layoutWidth: subQuestion.layoutWidth ?? null,
    nextPlacement: subQuestion.nextPlacement ?? null,
    goUp: subQuestion.goUp ?? null,
    manuscriptEnabled: subQuestion.manuscriptPaper?.enabled ?? false,
    manuscriptColumns: subQuestion.manuscriptPaper?.columns ?? 20,
    manuscriptRows: subQuestion.manuscriptPaper?.rows ?? 10,
    manuscriptCellSizeMm: 0, // 廃止: cellHeight / rows から逆算
    manuscriptGuideFontSize: subQuestion.manuscriptPaper?.guideFontSize ?? null,
    manuscriptGuidePosition: subQuestion.manuscriptPaper?.guidePosition ?? null,
    manuscriptGuidePadding: subQuestion.manuscriptPaper?.guidePadding ?? null,
    borderStyleTop: subQuestion.borderStyles?.top ?? null,
    borderStyleBottom: subQuestion.borderStyles?.bottom ?? null,
    borderStyleLeft: subQuestion.borderStyles?.left ?? null,
    borderStyleRight: subQuestion.borderStyles?.right ?? null,
  }
}

export async function upsertAsbSubQuestion(
  tx: Prisma.TransactionClient,
  majorQuestionId: string,
  subQuestion: SubQuestion,
  order: number,
  existing: AsbSubQuestion | undefined
): Promise<boolean> {
  const data = asbSubQuestionRow(majorQuestionId, subQuestion, order)
  return writeRow(
    existing,
    data,
    () => tx.asbSubQuestion.create({ data: { id: subQuestion.id, ...data } }),
    () => tx.asbSubQuestion.update({ where: { id: subQuestion.id }, data })
  )
}

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
// 枝問
// =============================================================================

function asbBranchQuestionRow(
  subQuestionId: string,
  branchQuestion: BranchQuestion,
  order: number
) {
  return {
    subQuestionId,
    label: branchQuestion.label,
    order,
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

export async function upsertAsbBranchQuestion(
  tx: Prisma.TransactionClient,
  subQuestionId: string,
  branchQuestion: BranchQuestion,
  order: number,
  existing: AsbBranchQuestion | undefined
): Promise<boolean> {
  const data = asbBranchQuestionRow(subQuestionId, branchQuestion, order)
  return writeRow(
    existing,
    data,
    () =>
      tx.asbBranchQuestion.create({ data: { id: branchQuestion.id, ...data } }),
    () =>
      tx.asbBranchQuestion.update({ where: { id: branchQuestion.id }, data })
  )
}

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
