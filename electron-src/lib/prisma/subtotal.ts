import type { Prisma, Subtotal } from "@prisma/client"
import prisma from "./client"

// Subtotal を作成
export const createSubtotal = async (
  data: Prisma.SubtotalUncheckedCreateInput // subtotalGroupId を直接含める
) => {
  return prisma.subtotal.create({
    data,
  })
}

// 複数の Subtotal を作成 (特定の SubtotalGroup に対して)
export const createManySubtotals = async (
  items: Prisma.SubtotalUncheckedCreateInput[]
) => {
  return prisma.subtotal.createMany({
    data: items,
  })
}

// Subtotal を更新
export const updateSubtotal = async (
  id: string,
  data: Prisma.SubtotalUpdateInput
) => {
  return prisma.subtotal.update({
    where: { id },
    data,
  })
}

// Subtotal を削除
export const deleteSubtotal = async (id: string) => {
  // 関連する CropSubtotal も削除される（onDelete: Cascade が設定済み）
  return prisma.subtotal.delete({
    where: { id },
  })
}

// SubtotalGroup ID で Subtotal を取得
export const getSubtotalsByGroupId = async (subtotalGroupId: string) => {
  return prisma.subtotal.findMany({
    where: { subtotalGroupId },
    orderBy: {
      order: "asc",
    },
  })
}

// IDで Subtotal を取得
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

// Subtotal の順序を一括更新
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
