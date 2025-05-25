import type { Prisma, SubtotalDefinition } from "@prisma/client"
import prisma from "./client"

// SubtotalDefinition を作成
export const createSubtotalDefinition = async (
  data: Prisma.SubtotalDefinitionUncheckedCreateInput, // layoutRegionId と questionGroupItemId を直接含める
) => {
  return prisma.subtotalDefinition.create({
    data,
    include: {
      layoutRegion: true,
      questionGroupItem: true,
    },
  })
}

// 複数の SubtotalDefinition を作成 (特定の LayoutRegion に対して)
export const createManySubtotalDefinitions = async (
  definitions: Prisma.SubtotalDefinitionUncheckedCreateInput[],
) => {
  return prisma.subtotalDefinition.createMany({
    data: definitions,
  })
}

// SubtotalDefinition を削除 (IDで)
export const deleteSubtotalDefinition = async (id: string) => {
  return prisma.subtotalDefinition.delete({
    where: { id },
  })
}

// LayoutRegion ID で SubtotalDefinition を削除 (特定のレイアウト領域の定義をすべて削除)
export const deleteSubtotalDefinitionsByLayoutRegionId = async (
  layoutRegionId: string,
) => {
  return prisma.subtotalDefinition.deleteMany({
    where: { layoutRegionId },
  })
}

// QuestionGroupItem ID で SubtotalDefinition を取得 (特定のグループ項目を参照する集計定義を取得)
export const getSubtotalDefinitionsByQuestionGroupItemId = async (
  questionGroupItemId: string,
) => {
  return prisma.subtotalDefinition.findMany({
    where: { questionGroupItemId },
    include: {
      layoutRegion: true,
    },
  })
}

// LayoutRegion ID で SubtotalDefinition を取得 (特定のレイアウト領域が持つ集計定義を取得)
export const getSubtotalDefinitionsByLayoutRegionId = async (
  layoutRegionId: string,
) => {
  return prisma.subtotalDefinition.findMany({
    where: { layoutRegionId },
    include: {
      questionGroupItem: true,
    },
  })
}

export type SubtotalDefinitionWithRelations =
  Prisma.SubtotalDefinitionGetPayload<{
    include: {
      layoutRegion: true
      questionGroupItem: true
    }
  }>

export type SubtotalDefinitionPayload = SubtotalDefinition
