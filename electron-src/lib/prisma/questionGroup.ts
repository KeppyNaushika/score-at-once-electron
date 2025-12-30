import type { Prisma, SubtotalGroup } from "@prisma/client"
import prisma from "./client"

// QuestionGroup を作成 (SubtotalGroup として実装)
export const createQuestionGroup = async (
  data: Prisma.SubtotalGroupUncheckedCreateInput
) => {
  return prisma.subtotalGroup.create({
    data,
    include: {
      subtotals: true, // 作成後にsubtotalsも返す
    },
  })
}

// QuestionGroup を更新
export const updateQuestionGroup = async (
  id: string,
  data: Prisma.SubtotalGroupUpdateInput
) => {
  return prisma.subtotalGroup.update({
    where: { id },
    data,
    include: {
      subtotals: true,
    },
  })
}

// QuestionGroup を削除
export const deleteQuestionGroup = async (id: string) => {
  // 関連する Subtotal, CropSubtotal も削除されるか確認
  // (onDelete: Cascade が設定されていれば自動)
  return prisma.subtotalGroup.delete({
    where: { id },
  })
}

// プロジェクトIDで QuestionGroup を取得
export const getQuestionGroupsByProjectId = async (projectId: string) => {
  // ProjectSubtotalGroup経由でSubtotalGroupを取得
  const projectSubtotalGroups = await prisma.projectSubtotalGroup.findMany({
    where: { projectId },
    include: {
      subtotalGroup: {
        include: {
          subtotals: {
            orderBy: {
              order: "asc",
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  })

  // SubtotalGroupのリストを返す（互換性のため）
  return projectSubtotalGroups.map((psg) => ({
    ...psg.subtotalGroup,
    items: psg.subtotalGroup.subtotals, // 互換性のためitemsという名前でsubtotalsを公開
    projectId, // 互換性のためprojectIdを追加
  }))
}

// IDで QuestionGroup を取得
export const getQuestionGroupById = async (id: string) => {
  const subtotalGroup = await prisma.subtotalGroup.findUnique({
    where: { id },
    include: {
      subtotals: {
        orderBy: {
          order: "asc",
        },
      },
      projectSubtotalGroups: {
        include: {
          project: true,
        },
      },
    },
  })

  if (!subtotalGroup) {
    return null
  }

  // 互換性のためitems, projectを含む形式で返す
  return {
    ...subtotalGroup,
    items: subtotalGroup.subtotals,
    project: subtotalGroup.projectSubtotalGroups[0]?.project || null,
  }
}

export type QuestionGroupWithItems = {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  items: Array<{
    id: string
    name: string
    maxScore: number
    order: number
    subtotalGroupId: string
    createdAt: Date
    updatedAt: Date
  }>
  project?: {
    id: string
    name: string
    createdAt: Date
    updatedAt: Date
    tag?: string | null
  } | null
  projectId?: string
}

export type QuestionGroupPayload = SubtotalGroup
