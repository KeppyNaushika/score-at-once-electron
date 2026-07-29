import type { Prisma } from "@prisma/client"

import prisma from "./client"

/** 小計定義（Subtotal）を作成する（subtotalGroup・cropSubtotals含む） */
export const createSubtotalDefinition = async (
  data: Prisma.SubtotalUncheckedCreateInput // cropRegionId と subtotalId を直接含める
) => {
  return prisma.subtotal.create({
    data,
    include: {
      subtotalGroup: true,
      cropSubtotals: true,
    },
  })
}

/** 複数の小計定義（Subtotal）を一括作成する */
export const createManySubtotalDefinitions = async (
  definitions: Prisma.SubtotalUncheckedCreateInput[]
) => {
  return prisma.subtotal.createMany({
    data: definitions,
  })
}

/** IDで小計定義（Subtotal）を削除する */
export const deleteSubtotalDefinition = async (id: string) => {
  return prisma.subtotal.delete({
    where: { id },
  })
}

/** 採点領域IDに紐づく小計定義を全て削除する（未実装：新スキーマ対応待ち） */
export const deleteSubtotalDefinitionsByCropRegionId = async (
  _cropRegionId: string
) => {
  console.warn(
    "deleteSubtotalDefinitionsByLayoutRegionId needs rewriting for new schema"
  )
  return { count: 0 }
}

/** 設問グループ項目IDで小計定義一覧を取得する（未実装：新スキーマ対応待ち） */
export const getSubtotalDefinitionsByQuestionGroupItemId = async (
  _questionGroupItemId: string
) => {
  console.warn(
    "getSubtotalDefinitionsByQuestionGroupItemId needs rewriting for new schema"
  )
  return []
}

export type SubtotalWithRelations = Prisma.SubtotalGetPayload<{
  include: {
    subtotalGroup: true
    cropSubtotals: true
  }
}>
