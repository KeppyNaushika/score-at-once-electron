import type { Prisma, Subtotal } from "@prisma/client"

import prisma from "./client"

/** 設問グループ項目（Subtotal）を1件作成する */
export const createQuestionGroupItem = async (
  data: Prisma.SubtotalUncheckedCreateInput // subtotalGroupId を直接含める
) => {
  return prisma.subtotal.create({
    data,
  })
}

/** 複数の設問グループ項目（Subtotal）を一括作成する */
export const createManyQuestionGroupItems = async (
  items: Prisma.SubtotalUncheckedCreateInput[]
) => {
  return prisma.subtotal.createMany({
    data: items,
  })
}

/** 設問グループ項目（Subtotal）を更新する */
export const updateQuestionGroupItem = async (
  id: string,
  data: Prisma.SubtotalUpdateInput
) => {
  return prisma.subtotal.update({
    where: { id },
    data,
  })
}

/** 設問グループ項目（Subtotal）を削除する（関連CropSubtotalもカスケード削除） */
export const deleteQuestionGroupItem = async (id: string) => {
  // 関連する CropSubtotal も削除されるか確認
  return prisma.subtotal.delete({
    where: { id },
  })
}

/** 設問グループIDで項目一覧を取得する（order昇順） */
export const getQuestionGroupItemsByGroupId = async (
  questionGroupId: string // 実際はsubtotalGroupId
) => {
  return prisma.subtotal.findMany({
    where: { subtotalGroupId: questionGroupId },
    orderBy: {
      order: "asc",
    },
  })
}

/** IDで設問グループ項目を取得する（subtotalGroup・cropSubtotals含む） */
export const getQuestionGroupItemById = async (id: string) => {
  return prisma.subtotal.findUnique({
    where: { id },
    include: {
      subtotalGroup: true, // 親の SubtotalGroup も取得
      cropSubtotals: true, // 関連する CropSubtotal も取得
    },
  })
}

export type SubtotalWithDetails = Prisma.SubtotalGetPayload<{
  include: {
    subtotalGroup: true
    cropSubtotals: true
  }
}>

/** 設問グループ項目の表示順序をトランザクション内で一括更新する */
export const updateQuestionGroupItemOrders = async (
  orders: { id: string; order: number }[]
) => {
  const updates = orders.map(({ id, order }) =>
    prisma.subtotal.update({
      where: { id },
      data: { order },
    })
  )

  const result = await prisma.$transaction(updates)

  // BatchPayload形式で返す
  return { count: result.length }
}

export type QuestionGroupItemPayload = Subtotal
