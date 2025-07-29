import type { Prisma, Subtotal } from "@prisma/client"
import prisma from "./client"

// Subtotal を作成
export const createSubtotalDefinition = async (
  data: Prisma.SubtotalUncheckedCreateInput, // layoutRegionId と questionGroupItemId を直接含める
) => {
  return prisma.subtotal.create({
    data,
    include: {
      subtotalGroup: true,
      cropSubtotals: true,
    },
  })
}

// 複数の Subtotal を作成 (特定の LayoutRegion に対して)
export const createManySubtotalDefinitions = async (
  definitions: Prisma.SubtotalUncheckedCreateInput[],
) => {
  return prisma.subtotal.createMany({
    data: definitions,
  })
}

// Subtotal を削除 (IDで)
export const deleteSubtotalDefinition = async (id: string) => {
  return prisma.subtotal.delete({
    where: { id },
  })
}

// LayoutRegion ID で Subtotal を削除 (特定のレイアウト領域の定義をすべて削除)
// TODO: This function needs to be rewritten for new schema
export const deleteSubtotalDefinitionsByLayoutRegionId = async (
  layoutRegionId: string,
) => {
  console.warn("deleteSubtotalDefinitionsByLayoutRegionId needs rewriting for new schema")
  return { count: 0 }
}

// QuestionGroupItem ID で Subtotal を取得 (特定のグループ項目を参照する集計定義を取得)
// TODO: This function needs to be rewritten for new schema  
export const getSubtotalDefinitionsByQuestionGroupItemId = async (
  questionGroupItemId: string,
) => {
  console.warn("getSubtotalDefinitionsByQuestionGroupItemId needs rewriting for new schema")
  return []
}

// LayoutRegion ID で Subtotal を取得 (特定のレイアウト領域が持つ集計定義を取得)
// TODO: This function needs to be rewritten for new schema
export const getSubtotalDefinitionsByLayoutRegionId = async (
  layoutRegionId: string,
) => {
  console.warn("getSubtotalDefinitionsByLayoutRegionId needs rewriting for new schema")
  return []
}

export type SubtotalWithRelations =
  Prisma.SubtotalGetPayload<{
    include: {
      subtotalGroup: true
      cropSubtotals: true
    }
  }>

export type SubtotalPayload = Subtotal
