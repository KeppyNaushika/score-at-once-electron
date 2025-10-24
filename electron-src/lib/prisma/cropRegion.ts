import type { CropRegion, Prisma } from "@prisma/client"
import prisma from "./client"

// CropRegion を作成
export const createCropRegion = async (
  data: Prisma.CropRegionUncheckedCreateInput,
) => {
  if (!data.projectPageId) {
    throw new Error("projectPageId is required to create a crop region.")
  }

  const projectPage = await prisma.projectPage.findUnique({
    where: { id: data.projectPageId },
    select: { projectId: true },
  })

  if (!projectPage) {
    throw new Error(
      `Project page not found for crop region creation (id: ${data.projectPageId}).`,
    )
  }

  let orderIndex = data.orderIndex ?? null

  if (orderIndex === null || orderIndex === undefined) {
    const maxOrder = await prisma.cropRegion.aggregate({
      _max: { orderIndex: true },
      where: {
        projectPage: {
          projectId: projectPage.projectId,
        },
      },
    })

    const currentMax = maxOrder._max.orderIndex ?? -1
    orderIndex = currentMax + 1
  }

  return prisma.cropRegion.create({
    data: {
      ...data,
      orderIndex,
    },
    include: {
      projectPage: true,
      cropSubtotals: {
        include: {
          subtotal: true,
        },
      },
    },
  })
}

// 複数の CropRegion を作成
export const createManyCropRegions = async (
  data: Prisma.CropRegionCreateManyInput[],
) => {
  return prisma.cropRegion.createMany({
    data,
  })
}

// CropRegion を更新
export const updateCropRegion = async (
  id: string,
  data: Prisma.CropRegionUpdateInput,
) => {
  return prisma.cropRegion.update({
    where: { id },
    data,
    include: {
      projectPage: true,
      cropSubtotals: {
        include: {
          subtotal: true,
        },
      },
    },
  })
}

// CropRegion を削除
export const deleteCropRegion = async (id: string) => {
  return prisma.cropRegion.delete({
    where: { id },
  })
}

// プロジェクトIDで CropRegion を取得
export const getCropRegionsByProjectId = async (projectId: string) => {
  const regions = await prisma.cropRegion.findMany({
    where: { 
      projectPage: {
        projectId: projectId
      }
    },
    include: {
      projectPage: true, // projectPage情報を追加
      cropSubtotals: {
        include: {
          subtotal: true,
        },
      },
      questionScores: true, // 関連する QuestionScore も取得
    },
    orderBy: [
      { orderIndex: "asc" }, // 手動順序（最優先）
      { projectPage: { pageNumber: "asc" } }, // ページ順（フォールバック）
      { y: "asc" }, // Y座標（フォールバック）
      { x: "asc" }, // X座標（フォールバック）
    ],
  })

  // orderIndexがnullの領域があった場合、自動で設定する
  const regionsWithNullOrder = regions.filter(region => region.orderIndex === null)
  if (regionsWithNullOrder.length > 0) {
    console.log(`Found ${regionsWithNullOrder.length} regions with null orderIndex, fixing...`)
    
    // orderIndex順で並べ替え済みの結果を使用してorderIndexを設定
    const updates = regions.map((region, index) => 
      prisma.cropRegion.update({
        where: { id: region.id },
        data: { orderIndex: index }
      })
    )
    
    await Promise.all(updates)
    
    // 更新後のデータを再取得
    return await prisma.cropRegion.findMany({
      where: { 
        projectPage: {
          projectId: projectId
        }
      },
      include: {
        projectPage: true,
        cropSubtotals: {
          include: {
            subtotal: true,
          },
        },
        questionScores: true,
      },
      orderBy: [
        { orderIndex: "asc" },
        { projectPage: { pageNumber: "asc" } },
        { y: "asc" },
        { x: "asc" },
      ],
    })
  }

  return regions
}

/**
 * プロジェクトのQUESTION_ANSWER型領域のみを順序付きで取得（採点画面専用）
 * フィルタリングを DB レベルで行うことで正しい順序を保持
 */
export const getQuestionAnswerRegionsByProjectId = async (projectId: string) => {
  const regions = await prisma.cropRegion.findMany({
    where: { 
      projectPage: {
        projectId: projectId
      },
      type: "QUESTION_ANSWER" // DB レベルでフィルタリング
    },
    include: {
      projectPage: true,
      cropSubtotals: {
        include: {
          subtotal: true,
        },
      },
      questionScores: true,
    },
    orderBy: [
      { orderIndex: "asc" }, // 手動順序（最優先）
      { projectPage: { pageNumber: "asc" } }, // ページ順（フォールバック）
      { y: "asc" }, // Y座標（フォールバック）
      { x: "asc" }, // X座標（フォールバック）
    ],
  })

  // orderIndexがnullの領域があった場合、自動で設定する
  const regionsWithNullOrder = regions.filter(region => region.orderIndex === null)
  if (regionsWithNullOrder.length > 0) {
    console.log(`Found ${regionsWithNullOrder.length} question answer regions with null orderIndex, fixing...`)
    
    // 同じ修正ロジック
    for (let i = 0; i < regionsWithNullOrder.length; i++) {
      const region = regionsWithNullOrder[i]
      const newOrderIndex = regions.length + i // 既存の最大値の後に追加
      
      await prisma.cropRegion.update({
        where: { id: region.id },
        data: { orderIndex: newOrderIndex }
      })
      
      region.orderIndex = newOrderIndex
    }
  }

  return regions
}

// IDで CropRegion を取得
export const getCropRegionById = async (id: string) => {
  return prisma.cropRegion.findUnique({
    where: { id },
    include: {
      projectPage: true,
      cropSubtotals: {
        include: {
          subtotal: true,
        },
      },
      questionScores: true,
    },
  })
}

// 複数の CropRegion の順序を一括更新
export const updateCropRegionOrders = async (
  updates: Array<{ id: string; orderIndex: number }>,
) => {
  const updatePromises = updates.map((update) =>
    prisma.cropRegion.update({
      where: { id: update.id },
      data: { orderIndex: update.orderIndex },
    }),
  )

  return Promise.all(updatePromises)
}

export type CropRegionWithDetails = Prisma.CropRegionGetPayload<{
  include: {
    projectPage: true
    cropSubtotals: {
      include: {
        subtotal: true
      }
    }
    questionScores: true
  }
}>

export type CropRegionPayload = CropRegion
