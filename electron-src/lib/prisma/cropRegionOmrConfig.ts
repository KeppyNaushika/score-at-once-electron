/**
 * CropRegionOmrConfig CRUD操作
 */

import type {
  CropRegionOmrChoiceOption,
  CropRegionOmrConfig,
} from "@prisma/client"

import prisma from "./client"

export type CropRegionOmrConfigWithOptions = CropRegionOmrConfig & {
  choiceOptions: CropRegionOmrChoiceOption[]
}

export interface UpsertOmrConfigData {
  cropRegionId: string
  type: "choice" | "handwritten-digit"
  numChoices?: number | null
  choiceLayout?: string | null
  numDigits?: number | null
  correctAnswer?: string | null
  cellGeometryJson?: string | null
  colorThreshold?: number | null
  areaThreshold?: number | null
  choiceOptions?: Array<{
    choiceIndex: number
    label: string
    isCorrect: boolean
  }>
}

/**
 * OMR設定をupsert（作成または更新）
 */
export async function upsertOmrConfig(
  data: UpsertOmrConfigData
): Promise<CropRegionOmrConfigWithOptions> {
  return prisma.$transaction(async (tx) => {
    // 既存のconfigを検索
    const existing = await tx.cropRegionOmrConfig.findUnique({
      where: { cropRegionId: data.cropRegionId },
    })

    let config: CropRegionOmrConfig

    if (existing) {
      // 更新
      config = await tx.cropRegionOmrConfig.update({
        where: { id: existing.id },
        data: {
          type: data.type,
          numChoices: data.numChoices ?? null,
          choiceLayout: data.choiceLayout ?? null,
          numDigits: data.numDigits ?? null,
          correctAnswer: data.correctAnswer ?? null,
          cellGeometryJson: data.cellGeometryJson ?? null,
          colorThreshold: data.colorThreshold ?? null,
          areaThreshold: data.areaThreshold ?? null,
        },
      })

      // 既存のchoiceOptionsを削除して再作成
      await tx.cropRegionOmrChoiceOption.deleteMany({
        where: { omrConfigId: config.id },
      })
    } else {
      // 新規作成
      config = await tx.cropRegionOmrConfig.create({
        data: {
          cropRegionId: data.cropRegionId,
          type: data.type,
          numChoices: data.numChoices ?? null,
          choiceLayout: data.choiceLayout ?? null,
          numDigits: data.numDigits ?? null,
          correctAnswer: data.correctAnswer ?? null,
          cellGeometryJson: data.cellGeometryJson ?? null,
          colorThreshold: data.colorThreshold ?? null,
          areaThreshold: data.areaThreshold ?? null,
        },
      })
    }

    // choiceOptionsを作成
    if (data.choiceOptions && data.choiceOptions.length > 0) {
      await tx.cropRegionOmrChoiceOption.createMany({
        data: data.choiceOptions.map((opt) => ({
          omrConfigId: config.id,
          choiceIndex: opt.choiceIndex,
          label: opt.label,
          isCorrect: opt.isCorrect,
        })),
      })
    }

    // リレーション込みで返す
    return tx.cropRegionOmrConfig.findUniqueOrThrow({
      where: { id: config.id },
      include: { choiceOptions: { orderBy: { choiceIndex: "asc" } } },
    })
  })
}

/**
 * OMR設定を削除
 */
export async function deleteOmrConfig(cropRegionId: string): Promise<void> {
  await prisma.cropRegionOmrConfig.deleteMany({
    where: { cropRegionId },
  })
}

/**
 * 試験IDに紐づく全OMR設定を取得
 */
export async function getOmrConfigsByExamId(
  examId: string
): Promise<CropRegionOmrConfigWithOptions[]> {
  return prisma.cropRegionOmrConfig.findMany({
    where: {
      cropRegion: {
        examPage: { examId },
      },
    },
    include: {
      choiceOptions: { orderBy: { choiceIndex: "asc" } },
    },
    orderBy: {
      cropRegion: { orderIndex: "asc" },
    },
  })
}

/**
 * CropRegion IDに紐づくOMR設定を取得
 */
export async function getOmrConfigByCropRegionId(
  cropRegionId: string
): Promise<CropRegionOmrConfigWithOptions | null> {
  return prisma.cropRegionOmrConfig.findUnique({
    where: { cropRegionId },
    include: {
      choiceOptions: { orderBy: { choiceIndex: "asc" } },
    },
  })
}
