import type { Prisma, Subtotal } from "@prisma/client"

import prisma from "./client"

/** 小計項目（Subtotal）を1件作成する */
export const createSubtotal = async (
  data: Prisma.SubtotalUncheckedCreateInput // subtotalGroupId を直接含める
) => {
  return prisma.subtotal.create({
    data,
  })
}

/** 複数の小計項目（Subtotal）を一括作成する */
export const createManySubtotals = async (
  items: Prisma.SubtotalUncheckedCreateInput[]
) => {
  return prisma.subtotal.createMany({
    data: items,
  })
}

/** 小計項目（Subtotal）を更新する */
export const updateSubtotal = async (
  id: string,
  data: Prisma.SubtotalUpdateInput
) => {
  return prisma.subtotal.update({
    where: { id },
    data,
  })
}

/** 小計項目（Subtotal）を削除する（関連CropSubtotalもカスケード削除） */
export const deleteSubtotal = async (id: string) => {
  // 関連する CropSubtotal も削除される（onDelete: Cascade が設定済み）
  return prisma.subtotal.delete({
    where: { id },
  })
}

/** SubtotalGroup IDで小計項目一覧を取得する（order昇順） */
export const getSubtotalsByGroupId = async (subtotalGroupId: string) => {
  return prisma.subtotal.findMany({
    where: { subtotalGroupId },
    orderBy: {
      order: "asc",
    },
  })
}

/** IDで小計項目を取得する（subtotalGroup・cropSubtotals含む） */
export const getSubtotalById = async (id: string) => {
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

/** 小計項目の表示順序をトランザクション内で一括更新する */
export const updateSubtotalOrders = async (
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

export type SubtotalPayload = Subtotal
