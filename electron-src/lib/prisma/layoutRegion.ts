import type { Prisma, LayoutRegion } from "@prisma/client"
import prisma from "./client"

// LayoutRegion を作成
export const createLayoutRegion = async (
  data: Prisma.LayoutRegionUncheckedCreateInput, // projectId を直接含めるため Unchecked を使用
) => {
  return prisma.layoutRegion.create({
    data,
  })
}

// 複数の LayoutRegion を作成
export const createManyLayoutRegions = async (
  data: Prisma.LayoutRegionCreateManyInput[],
) => {
  return prisma.layoutRegion.createMany({
    data,
  })
}

// LayoutRegion を更新
export const updateLayoutRegion = async (
  id: string,
  data: Prisma.LayoutRegionUpdateInput,
) => {
  return prisma.layoutRegion.update({
    where: { id },
    data,
    include: {
      // 更新後に必要な関連データも返す
      subtotalDefinitions: {
        include: {
          questionGroupItem: true,
        },
      },
      questionSubtotalAssignments: {
        include: {
          questionGroupItem: true,
        },
      },
    },
  })
}

// 複数の LayoutRegion の順序を一括更新
export const updateLayoutRegionOrders = async (
  updates: Array<{ id: string; orderIndex: number }>
) => {
  const updatePromises = updates.map((update) =>
    prisma.layoutRegion.update({
      where: { id: update.id },
      data: { orderIndex: update.orderIndex },
    })
  )
  
  return Promise.all(updatePromises)
}

// LayoutRegion を削除
export const deleteLayoutRegion = async (id: string) => {
  // 関連する SubtotalDefinition や QuestionSubtotalAssignment も削除する必要があるか確認
  // スキーマで onDelete: Cascade が設定されていれば自動的に削除される
  return prisma.layoutRegion.delete({
    where: { id },
  })
}

// プロジェクトIDで LayoutRegion を取得
export const getLayoutRegionsByProjectId = async (projectId: string) => {
  return prisma.layoutRegion.findMany({
    where: { projectId },
    include: {
      subtotalDefinitions: {
        include: {
          questionGroupItem: true,
        },
      },
      questionSubtotalAssignments: {
        include: {
          questionGroupItem: true,
        },
      },
      questionScores: true, // 関連する QuestionScore も取得
    },
    orderBy: [
      { masterImageId: "asc" },    // ページ順（最優先）
      { orderIndex: "asc" },       // 手動順序（優先）
      { y: "asc" },               // Y座標（フォールバック）
      { x: "asc" }                // X座標（フォールバック）
    ],
  })
}

// IDで LayoutRegion を取得
export const getLayoutRegionById = async (id: string) => {
  return prisma.layoutRegion.findUnique({
    where: { id },
    include: {
      subtotalDefinitions: {
        include: {
          questionGroupItem: true,
        },
      },
      questionSubtotalAssignments: {
        include: {
          questionGroupItem: true,
        },
      },
      questionScores: true,
      project: true, // 関連するプロジェクト情報も取得
    },
  })
}

export type LayoutRegionWithDetails = Prisma.LayoutRegionGetPayload<{
  include: {
    subtotalDefinitions: {
      include: {
        questionGroupItem: true
      }
    }
    questionSubtotalAssignments: {
      include: {
        questionGroupItem: true
      }
    }
    questionScores: true
    project: true
  }
}>

export type LayoutRegionPayload = LayoutRegion
