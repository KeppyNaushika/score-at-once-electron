import type { Prisma, Subtotal } from "@prisma/client"
import prisma from "./client"

// QuestionGroupItem を作成 (Subtotal として実装)
export const createQuestionGroupItem = async (
  data: Prisma.SubtotalUncheckedCreateInput, // subtotalGroupId を直接含める
) => {
  return prisma.subtotal.create({
    data,
  })
}

// 複数の QuestionGroupItem を作成 (特定の QuestionGroup に対して)
export const createManyQuestionGroupItems = async (
  items: Prisma.SubtotalUncheckedCreateInput[],
) => {
  return prisma.subtotal.createMany({
    data: items,
  })
}

// QuestionGroupItem を更新
export const updateQuestionGroupItem = async (
  id: string,
  data: Prisma.SubtotalUpdateInput,
) => {
  return prisma.subtotal.update({
    where: { id },
    data,
  })
}

// QuestionGroupItem を削除
export const deleteQuestionGroupItem = async (id: string) => {
  // 関連する CropSubtotal も削除されるか確認
  return prisma.subtotal.delete({
    where: { id },
  })
}

// QuestionGroup ID で QuestionGroupItem を取得
export const getQuestionGroupItemsByGroupId = async (
  questionGroupId: string, // 実際はsubtotalGroupId
) => {
  return prisma.subtotal.findMany({
    where: { subtotalGroupId: questionGroupId },
    orderBy: {
      order: "asc",
    },
  })
}

// IDで QuestionGroupItem を取得
export const getQuestionGroupItemById = async (id: string) => {
  return prisma.subtotal.findUnique({
    where: { id },
    include: {
      subtotalGroup: true, // 親の SubtotalGroup も取得
      cropSubtotals: true, // 関連する CropSubtotal も取得
    },
  })
}

export type QuestionGroupItemWithDetails = Prisma.SubtotalGetPayload<{
  include: {
    subtotalGroup: true
    cropSubtotals: true
  }
}>

// QuestionGroupItem の順序を一括更新
export const updateQuestionGroupItemOrders = async (
  orders: { id: string; order: number }[],
) => {
  console.log("🔄 DB: updateQuestionGroupItemOrders called with:", orders)

  const updates = orders.map(({ id, order }) =>
    prisma.subtotal.update({
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

export type QuestionGroupItemPayload = Subtotal