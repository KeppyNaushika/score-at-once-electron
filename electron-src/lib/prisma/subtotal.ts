import type { Prisma } from "@prisma/client"

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

/**
 * getSubtotalById の include 形状（SSOT）。
 * questionGroupItem.ts と同一形状だったため、こちらへ統合した。
 */
export const subtotalWithGroupAndCropsInclude = {
  subtotalGroup: true,
  cropSubtotals: true,
} satisfies Prisma.SubtotalInclude

/** subtotalGroup・cropSubtotals を含む Subtotal（getSubtotalById の返り値） */
export type SubtotalWithGroupAndCrops = Prisma.SubtotalGetPayload<{
  include: typeof subtotalWithGroupAndCropsInclude
}>

/** IDで小計項目を取得する（subtotalGroup・cropSubtotals含む） */
export const getSubtotalById = async (id: string) => {
  return prisma.subtotal.findUnique({
    where: { id },
    include: subtotalWithGroupAndCropsInclude,
  })
}

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
