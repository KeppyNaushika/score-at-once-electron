import type { CropRegion, Prisma } from "@prisma/client"
import prisma from "./client"

// CropRegion を作成
export const createCropRegion = async (
  data: Prisma.CropRegionUncheckedCreateInput, // projectId を直接含めるため Unchecked を使用
) => {
  return prisma.cropRegion.create({
    data,
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
      // 更新後に必要な関連データも返す
      projectPage: true,
      cropSubtotals: {
        include: {
          subtotal: true,
        },
      },
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

// CropRegion を削除
export const deleteCropRegion = async (id: string) => {
  // 関連する CropSubtotal も削除される（onDelete: Cascade 設定済み）
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
      projectPage: true, // masterImage情報を追加
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