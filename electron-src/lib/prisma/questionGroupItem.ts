import type { Prisma, QuestionGroupItem } from "@prisma/client"
import prisma from "./client"

// QuestionGroupItem を作成
export const createQuestionGroupItem = async (
  data: Prisma.QuestionGroupItemUncheckedCreateInput, // questionGroupId を直接含める
) => {
  return prisma.questionGroupItem.create({
    data,
  })
}

// 複数の QuestionGroupItem を作成 (特定の QuestionGroup に対して)
export const createManyQuestionGroupItems = async (
  items: Prisma.QuestionGroupItemUncheckedCreateInput[],
) => {
  return prisma.questionGroupItem.createMany({
    data: items,
  })
}

// QuestionGroupItem を更新
export const updateQuestionGroupItem = async (
  id: string,
  data: Prisma.QuestionGroupItemUpdateInput,
) => {
  return prisma.questionGroupItem.update({
    where: { id },
    data,
  })
}

// QuestionGroupItem を削除
export const deleteQuestionGroupItem = async (id: string) => {
  // 関連する SubtotalDefinition, QuestionSubtotalAssignment も削除されるか確認
  return prisma.questionGroupItem.delete({
    where: { id },
  })
}

// QuestionGroup ID で QuestionGroupItem を取得
export const getQuestionGroupItemsByGroupId = async (
  questionGroupId: string,
) => {
  return prisma.questionGroupItem.findMany({
    where: { questionGroupId },
    orderBy: {
      order: "asc",
    },
  })
}

// IDで QuestionGroupItem を取得
export const getQuestionGroupItemById = async (id: string) => {
  return prisma.questionGroupItem.findUnique({
    where: { id },
    include: {
      questionGroup: true, // 親の QuestionGroup も取得
      subtotalDefinitions: true, // 関連する SubtotalDefinition も取得
      questionAssignments: true, // 関連する QuestionSubtotalAssignment も取得
    },
  })
}

export type QuestionGroupItemWithDetails = Prisma.QuestionGroupItemGetPayload<{
  include: {
    questionGroup: true
    subtotalDefinitions: true
    questionAssignments: true
  }
}>

// QuestionGroupItem の順序を一括更新
export const updateQuestionGroupItemOrders = async (
  orders: { id: string; order: number }[],
) => {
  console.log("🔄 DB: updateQuestionGroupItemOrders called with:", orders)

  const updates = orders.map(({ id, order }) =>
    prisma.questionGroupItem.update({
      where: { id },
      data: { order },
    }),
  )

  console.log("🔄 DB: Executing transaction with", updates.length, "updates")
  const result = await prisma.$transaction(updates)
  console.log("✅ DB: Transaction completed, result:", result)

  // BatchPayload形式で返す
  const batchResult = { count: result.length }
  console.log("✅ DB: Returning batch result:", batchResult)
  return batchResult
}

export type QuestionGroupItemPayload = QuestionGroupItem
