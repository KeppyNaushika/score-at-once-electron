import type { Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import {
  resolveExamScope,
  resolveExamScopeByCropRegion,
  resolveExamScopeByPage,
} from "./auditScope"
import prisma from "./client"

/**
 * CropRegion の include 形状（SSOT）。型（GetPayload）と実クエリの双方がこの const を
 * 参照するため両者が乖離しない。
 *
 * 領域メタデータの作成/更新（create/update）は採点結果を必要としないため questionScores を
 * 引かない軽い形状。get 系のみ採点画面向けに questionScores も引く。
 */
export const cropRegionWithSubtotalsInclude = {
  examPage: true,
  cropSubtotals: {
    include: {
      subtotal: true,
    },
  },
} satisfies Prisma.CropRegionInclude

export const cropRegionWithSubtotalsAndScoresInclude = {
  examPage: true,
  cropSubtotals: {
    include: {
      subtotal: true,
    },
  },
  questionScores: true,
} satisfies Prisma.CropRegionInclude

/** examPage・cropSubtotals.subtotal を含む CropRegion（create/update の返り値） */
export type CropRegionWithSubtotals = Prisma.CropRegionGetPayload<{
  include: typeof cropRegionWithSubtotalsInclude
}>

/** examPage・cropSubtotals.subtotal・questionScores を含む CropRegion（get 系の返り値） */
export type CropRegionWithSubtotalsAndScores = Prisma.CropRegionGetPayload<{
  include: typeof cropRegionWithSubtotalsAndScoresInclude
}>

/** 設問領域を作成する（orderIndex未指定時は自動採番、examPage・cropSubtotals リレーション含む） */
export const createCropRegion = async (
  data: Prisma.CropRegionUncheckedCreateInput
) => {
  if (!data.examPageId) {
    throw new Error("examPageId is required to create a crop region.")
  }

  const examPage = await prisma.examPage.findUnique({
    where: { id: data.examPageId },
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

  const region = await prisma.cropRegion.create({
    data: {
      ...data,
      orderIndex,
    },
    include: cropRegionWithSubtotalsInclude,
  })

  const scope = await resolveExamScope(examPage.examId)
  await recordAuditLog({
    action: "exam.region.create",
    entityType: "CropRegion",
    entityId: region.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: region.label || null,
  })

  return region
}

/** 複数の設問領域を一括作成する */
export const createManyCropRegions = async (
  data: Prisma.CropRegionCreateManyInput[]
) => {
  const result = await prisma.cropRegion.createMany({
    data,
  })

  if (data.length > 0) {
    const scope = await resolveExamScopeByPage(data[0].examPageId)
    await recordAuditLog({
      action: "exam.region.create",
      entityType: "CropRegion",
      entityId: data[0].examPageId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: `採点領域を${data.length}個作成しました`,
      extra: { count: data.length },
    })
  }

  return result
}

/** 設問領域を更新する（examPage・cropSubtotals リレーション含む） */
export const updateCropRegion = async (
  id: string,
  data: Prisma.CropRegionUpdateInput
) => {
  const region = await prisma.cropRegion.update({
    where: { id },
    data,
    include: cropRegionWithSubtotalsInclude,
  })

  const scope = await resolveExamScope(region.examPage.examId)
  await recordAuditLog({
    action: "exam.region.update",
    entityType: "CropRegion",
    entityId: region.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: region.label || null,
  })

  return region
}

/** 設問領域を削除する */
export const deleteCropRegion = async (id: string) => {
  const scope = await resolveExamScopeByCropRegion(id)
  const before = await prisma.cropRegion.findUnique({
    where: { id },
  })

  const region = await prisma.cropRegion.delete({
    where: { id },
  })

  await recordAuditLog({
    action: "exam.region.delete",
    entityType: "CropRegion",
    entityId: id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: before?.label || null,
  })

  return region
}

/** 試験IDで全設問領域を取得する（orderIndexがnullの場合は自動設定、examPage・cropSubtotals・questionScores リレーション含む） */
export const getCropRegionsByExamId = async (examId: string) => {
  const regions = await prisma.cropRegion.findMany({
    where: {
      examPage: {
        examId: examId,
      },
    },
    include: cropRegionWithSubtotalsAndScoresInclude,
    orderBy: [
      { orderIndex: "asc" }, // 手動順序（最優先）
      { examPage: { pageNumber: "asc" } }, // ページ順（フォールバック）
      { y: "asc" }, // Y座標（フォールバック）
      { x: "asc" }, // X座標（フォールバック）
      { id: "asc" }, // 同座標・同ページ番号でも並びを決定的にする
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
      include: cropRegionWithSubtotalsAndScoresInclude,
      orderBy: [
        { orderIndex: "asc" },
        { examPage: { pageNumber: "asc" } },
        { y: "asc" },
        { x: "asc" },
        { id: "asc" },
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
    include: cropRegionWithSubtotalsAndScoresInclude,
    orderBy: [
      { orderIndex: "asc" }, // 手動順序（最優先）
      { examPage: { pageNumber: "asc" } }, // ページ順（フォールバック）
      { y: "asc" }, // Y座標（フォールバック）
      { x: "asc" }, // X座標（フォールバック）
      { id: "asc" }, // 同座標・同ページ番号でも並びを決定的にする
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
    include: cropRegionWithSubtotalsAndScoresInclude,
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

  const result = await Promise.all(updatePromises)

  if (updates.length > 0) {
    const scope = await resolveExamScopeByCropRegion(updates[0].id)
    await recordAuditLog({
      action: "exam.region.reorder",
      entityType: "CropRegion",
      entityId: scope.scopeId ?? updates[0].id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      coalesceKey: `region_reorder:${scope.scopeId ?? updates[0].id}`,
    })
  }

  return result
}
