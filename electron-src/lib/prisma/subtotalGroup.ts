import type { Prisma, SubtotalGroup } from "@prisma/client"
import prisma from "./client"

// SubtotalGroup を作成
export const createSubtotalGroup = async (
  data: Prisma.SubtotalGroupUncheckedCreateInput, // projectId を直接含める
) => {
  return prisma.subtotalGroup.create({
    data,
    include: {
      subtotals: true, // 作成後にサブトータルも返す
    },
  })
}

// SubtotalGroup を更新
export const updateSubtotalGroup = async (
  id: string,
  data: Prisma.SubtotalGroupUpdateInput,
) => {
  return prisma.subtotalGroup.update({
    where: { id },
    data,
    include: {
      subtotals: true,
    },
  })
}

// SubtotalGroup を削除
export const deleteSubtotalGroup = async (id: string) => {
  // 関連する Subtotal, CropSubtotal も削除される（onDelete: Cascade が設定済み）
  return prisma.subtotalGroup.delete({
    where: { id },
  })
}

// プロジェクトIDで SubtotalGroup を取得
export const getSubtotalGroupsByProjectId = async (projectId: string) => {
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
  return projectSubtotalGroups.map(psg => ({
    ...psg.subtotalGroup,
    projectId, // 互換性のためprojectIdを追加
  }))
}

// IDで SubtotalGroup を取得
export const getSubtotalGroupById = async (id: string) => {
  return prisma.subtotalGroup.findUnique({
    where: { id },
    include: {
      subtotals: {
        orderBy: {
          // DnD順序に従って表示
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
}

export type SubtotalGroupWithSubtotals = Prisma.SubtotalGroupGetPayload<{
  include: {
    subtotals: true
    project: true
  }
}>

export type SubtotalGroupPayload = SubtotalGroup