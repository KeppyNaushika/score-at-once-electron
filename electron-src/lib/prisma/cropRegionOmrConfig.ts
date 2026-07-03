/**
 * CropRegionOmrConfig CRUD操作
 */

import type {
  CropRegionOmrChoiceOption,
  CropRegionOmrConfig,
  CropRegionOmrDigitBox,
} from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion } from "./auditScope"
import prisma from "./client"

export type CropRegionOmrConfigWithOptions = CropRegionOmrConfig & {
  choiceOptions: CropRegionOmrChoiceOption[]
  digitBoxes: CropRegionOmrDigitBox[]
}

export interface UpsertOmrConfigData {
  cropRegionId: string
  type: "choice" | "handwritten-digit"
  numChoices?: number | null
  choiceLayout?: string | null
  numDigits?: number | null
  correctAnswer?: string | null
  colorThreshold?: number | null
  areaThreshold?: number | null
  choiceOptions?: Array<{
    choiceIndex: number
    label: string
    isCorrect: boolean
    shape?: string | null
    normalizedCx?: number | null
    normalizedCy?: number | null
    normalizedWidth?: number | null
    normalizedHeight?: number | null
  }>
  digitBoxes?: Array<{
    digitIndex: number
    normalizedX: number
    normalizedY: number
    normalizedW: number
    normalizedH: number
  }>
}

/**
 * OMR設定をupsert（作成または更新）
 */
export async function upsertOmrConfig(
  data: UpsertOmrConfigData
): Promise<CropRegionOmrConfigWithOptions> {
  const result = await prisma.$transaction(async (tx) => {
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
          colorThreshold: data.colorThreshold ?? null,
          areaThreshold: data.areaThreshold ?? null,
        },
      })

      // 既存のchoiceOptions/digitBoxesを削除して再作成
      await tx.cropRegionOmrChoiceOption.deleteMany({
        where: { omrConfigId: config.id },
      })
      await tx.cropRegionOmrDigitBox.deleteMany({
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
          colorThreshold: data.colorThreshold ?? null,
          areaThreshold: data.areaThreshold ?? null,
        },
      })
    }

    // choiceOptionsを作成（バブル位置含む）
    if (data.choiceOptions && data.choiceOptions.length > 0) {
      await tx.cropRegionOmrChoiceOption.createMany({
        data: data.choiceOptions.map((choiceOption) => ({
          omrConfigId: config.id,
          choiceIndex: choiceOption.choiceIndex,
          label: choiceOption.label,
          isCorrect: choiceOption.isCorrect,
          shape: choiceOption.shape ?? null,
          normalizedCx: choiceOption.normalizedCx ?? null,
          normalizedCy: choiceOption.normalizedCy ?? null,
          normalizedWidth: choiceOption.normalizedWidth ?? null,
          normalizedHeight: choiceOption.normalizedHeight ?? null,
        })),
      })
    }

    // digitBoxesを作成
    if (data.digitBoxes && data.digitBoxes.length > 0) {
      await tx.cropRegionOmrDigitBox.createMany({
        data: data.digitBoxes.map((box) => ({
          omrConfigId: config.id,
          digitIndex: box.digitIndex,
          normalizedX: box.normalizedX,
          normalizedY: box.normalizedY,
          normalizedW: box.normalizedW,
          normalizedH: box.normalizedH,
        })),
      })
    }

    // リレーション込みで返す
    return tx.cropRegionOmrConfig.findUniqueOrThrow({
      where: { id: config.id },
      include: {
        choiceOptions: { orderBy: { choiceIndex: "asc" } },
        digitBoxes: { orderBy: { digitIndex: "asc" } },
      },
    })
  })

  const scope = await resolveExamScopeByCropRegion(data.cropRegionId)
  await recordAuditLog({
    action: "exam.omr_config.update",
    entityType: "CropRegionOmrConfig",
    entityId: result.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    coalesceKey: `omr_config:${data.cropRegionId}`,
  })

  return result
}

/**
 * OMR設定を削除
 */
export async function deleteOmrConfig(cropRegionId: string): Promise<void> {
  await prisma.cropRegionOmrConfig.deleteMany({
    where: { cropRegionId },
  })

  const scope = await resolveExamScopeByCropRegion(cropRegionId)
  await recordAuditLog({
    action: "exam.omr_config.update",
    entityType: "CropRegionOmrConfig",
    entityId: cropRegionId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    summary: "OMR設定を削除しました",
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
      digitBoxes: { orderBy: { digitIndex: "asc" } },
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
      digitBoxes: { orderBy: { digitIndex: "asc" } },
    },
  })
}
