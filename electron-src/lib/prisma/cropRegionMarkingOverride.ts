/**
 * 設問別採点記号印字設定のPrisma操作関数
 * 機能H: 設問別採点記号印字設定
 */

import prisma from "./client"

// =============================================================================
// CropRegionMarkingOverride（設問別マーク設定オーバーライド）
// =============================================================================

export interface MarkingOverrideData {
  markType: string
  symbol?: string | null
  color?: string | null
  visible?: boolean
}

/**
 * 設問の採点マークオーバーライド設定を取得
 */
export async function getCropRegionMarkingOverrides(cropRegionId: string) {
  return prisma.cropRegionMarkingOverride.findMany({
    where: { cropRegionId },
  })
}

/**
 * 設問の特定マークタイプのオーバーライド設定を取得
 */
export async function getCropRegionMarkingOverride(
  cropRegionId: string,
  markType: string
) {
  return prisma.cropRegionMarkingOverride.findUnique({
    where: {
      cropRegionId_markType: { cropRegionId, markType },
    },
  })
}

/**
 * 設問のオーバーライド設定を作成/更新
 */
export async function upsertCropRegionMarkingOverride(
  cropRegionId: string,
  data: MarkingOverrideData
) {
  return prisma.cropRegionMarkingOverride.upsert({
    where: {
      cropRegionId_markType: { cropRegionId, markType: data.markType },
    },
    update: {
      symbol: data.symbol,
      color: data.color,
      visible: data.visible,
    },
    create: {
      cropRegionId,
      markType: data.markType,
      symbol: data.symbol,
      color: data.color,
      visible: data.visible ?? true,
    },
  })
}

/**
 * 設問の複数オーバーライド設定を一括作成/更新
 */
export async function bulkUpsertCropRegionMarkingOverrides(
  cropRegionId: string,
  overrides: MarkingOverrideData[]
) {
  const operations = overrides.map((override) =>
    prisma.cropRegionMarkingOverride.upsert({
      where: {
        cropRegionId_markType: { cropRegionId, markType: override.markType },
      },
      update: {
        symbol: override.symbol,
        color: override.color,
        visible: override.visible,
      },
      create: {
        cropRegionId,
        markType: override.markType,
        symbol: override.symbol,
        color: override.color,
        visible: override.visible ?? true,
      },
    })
  )
  return prisma.$transaction(operations)
}

/**
 * 設問のオーバーライド設定を削除
 */
export async function deleteCropRegionMarkingOverride(
  cropRegionId: string,
  markType: string
) {
  return prisma.cropRegionMarkingOverride.deleteMany({
    where: { cropRegionId, markType },
  })
}

/**
 * 設問の全オーバーライド設定を削除（プロジェクト設定に戻す）
 */
export async function resetCropRegionMarkingOverrides(cropRegionId: string) {
  return prisma.cropRegionMarkingOverride.deleteMany({
    where: { cropRegionId },
  })
}

/**
 * プロジェクト内の全設問のオーバーライド設定を取得
 */
export async function getProjectCropRegionMarkingOverrides(projectId: string) {
  return prisma.cropRegionMarkingOverride.findMany({
    where: {
      cropRegion: {
        projectPage: {
          projectId,
        },
      },
    },
    include: {
      cropRegion: {
        select: {
          id: true,
          label: true,
          type: true,
        },
      },
    },
  })
}
