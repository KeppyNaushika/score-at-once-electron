import type { CropRegion, Prisma } from "@prisma/client"

import prisma from "./client"

/** 設問領域を作成する（orderIndex未指定時は自動採番、examPage・cropSubtotals リレーション含む） */
export const createCropRegion = async (
  data: Prisma.CropRegionUncheckedCreateInput
) => {
  if (!data.examPageId) {
    throw new Error("examPageId is required to create a crop region.")
  }

  const examPage = await prisma.examPage.findUnique({
    where: { id: data.examPageId },
    select: { examId: true },
  })

  if (!examPage) {
    throw new Error(
      `Exam page not found for crop region creation (id: ${data.examPageId}).`
    )
  }

  let orderIndex = data.orderIndex ?? null

  if (orderIndex === null || orderIndex === undefined) {
    const maxOrder = await prisma.cropRegion.aggregate({
      _max: { orderIndex: true },
      where: {
        examPage: {
          examId: examPage.examId,
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
      examPage: true,
      cropSubtotals: {
        include: {
          subtotal: true,
        },
      },
    },
  })
}

/** 複数の設問領域を一括作成する */
export const createManyCropRegions = async (
  data: Prisma.CropRegionCreateManyInput[]
) => {
  return prisma.cropRegion.createMany({
    data,
  })
}

/** 設問領域を更新する（examPage・cropSubtotals リレーション含む） */
export const updateCropRegion = async (
  id: string,
  data: Prisma.CropRegionUpdateInput
) => {
  return prisma.cropRegion.update({
    where: { id },
    data,
    include: {
      examPage: true,
      cropSubtotals: {
        include: {
          subtotal: true,
        },
      },
    },
  })
}

/** 設問領域を削除する */
export const deleteCropRegion = async (id: string) => {
  return prisma.cropRegion.delete({
    where: { id },
  })
}

/** 試験IDで全設問領域を取得する（orderIndexがnullの場合は自動設定、examPage・cropSubtotals・questionScores リレーション含む） */
export const getCropRegionsByExamId = async (examId: string) => {
  const regions = await prisma.cropRegion.findMany({
    where: {
      examPage: {
        examId: examId,
      },
    },
    include: {
      examPage: true, // examPage情報を追加
      cropSubtotals: {
        include: {
          subtotal: true,
        },
      },
      questionScores: true, // 関連する QuestionScore も取得
    },
    orderBy: [
      { orderIndex: "asc" }, // 手動順序（最優先）
      { examPage: { pageNumber: "asc" } }, // ページ順（フォールバック）
      { y: "asc" }, // Y座標（フォールバック）
      { x: "asc" }, // X座標（フォールバック）
    ],
  })

  // orderIndexがnullの領域があった場合、自動で設定する
  const regionsWithNullOrder = regions.filter(
    (region) => region.orderIndex === null
  )
  if (regionsWithNullOrder.length > 0) {
    // orderIndex順で並べ替え済みの結果を使用してorderIndexを設定
    const updates = regions.map((region, index) =>
      prisma.cropRegion.update({
        where: { id: region.id },
        data: { orderIndex: index },
      })
    )

    await Promise.all(updates)

    // 更新後のデータを再取得
    return await prisma.cropRegion.findMany({
      where: {
        examPage: {
          examId: examId,
        },
      },
      include: {
        examPage: true,
        cropSubtotals: {
          include: {
            subtotal: true,
          },
        },
        questionScores: true,
      },
      orderBy: [
        { orderIndex: "asc" },
        { examPage: { pageNumber: "asc" } },
        { y: "asc" },
        { x: "asc" },
      ],
    })
  }

  return regions
}

/**
 * 試験のQUESTION_ANSWER型領域のみを順序付きで取得（採点画面専用）
 * フィルタリングを DB レベルで行うことで正しい順序を保持
 */
export const getQuestionAnswerRegionsByExamId = async (examId: string) => {
  const regions = await prisma.cropRegion.findMany({
    where: {
      examPage: {
        examId: examId,
      },
      type: "QUESTION_ANSWER", // DB レベルでフィルタリング
    },
    include: {
      examPage: true,
      cropSubtotals: {
        include: {
          subtotal: true,
        },
      },
      questionScores: true,
    },
    orderBy: [
      { orderIndex: "asc" }, // 手動順序（最優先）
      { examPage: { pageNumber: "asc" } }, // ページ順（フォールバック）
      { y: "asc" }, // Y座標（フォールバック）
      { x: "asc" }, // X座標（フォールバック）
    ],
  })

  // orderIndexがnullの領域があった場合、自動で設定する
  const regionsWithNullOrder = regions.filter(
    (region) => region.orderIndex === null
  )
  if (regionsWithNullOrder.length > 0) {
    // 同じ修正ロジック
    for (let i = 0; i < regionsWithNullOrder.length; i++) {
      const region = regionsWithNullOrder[i]
      const newOrderIndex = regions.length + i // 既存の最大値の後に追加

      await prisma.cropRegion.update({
        where: { id: region.id },
        data: { orderIndex: newOrderIndex },
      })

      region.orderIndex = newOrderIndex
    }
  }

  return regions
}

/** IDで設問領域を取得する（examPage・cropSubtotals・questionScores リレーション含む） */
export const getCropRegionById = async (id: string) => {
  return prisma.cropRegion.findUnique({
    where: { id },
    include: {
      examPage: true,
      cropSubtotals: {
        include: {
          subtotal: true,
        },
      },
      questionScores: true,
    },
  })
}

/** 複数の設問領域のorderIndexを一括更新する */
export const updateCropRegionOrders = async (
  updates: Array<{ id: string; orderIndex: number }>
) => {
  const updatePromises = updates.map((update) =>
    prisma.cropRegion.update({
      where: { id: update.id },
      data: { orderIndex: update.orderIndex },
    })
  )

  return Promise.all(updatePromises)
}

export type CropRegionWithDetails = Prisma.CropRegionGetPayload<{
  include: {
    examPage: true
    cropSubtotals: {
      include: {
        subtotal: true
      }
    }
    questionScores: true
  }
}>

export type CropRegionPayload = CropRegion
