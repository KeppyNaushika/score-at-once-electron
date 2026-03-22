/**
 * 試験設定関連のPrisma操作関数
 */

import prisma from "./client"

// =============================================================================
// ExamMarkingFormat（採点マーク設定）
// =============================================================================

export interface MarkingFormatData {
  markType: string
  symbol: string
  color: string
  fontSize?: number | null
  strokeWidth?: number | null
}

/** 試験の全採点マーク設定を取得する */
export async function getExamMarkingFormats(examId: string) {
  return prisma.examMarkingFormat.findMany({
    where: { examId },
  })
}

/** 試験の特定マーク種別の採点マーク設定を取得する */
export async function getExamMarkingFormat(examId: string, markType: string) {
  return prisma.examMarkingFormat.findUnique({
    where: {
      examId_markType: { examId, markType },
    },
  })
}

/** 採点マーク設定を作成または更新する（examId+markTypeで一意） */
export async function upsertExamMarkingFormat(
  examId: string,
  data: MarkingFormatData
) {
  return prisma.examMarkingFormat.upsert({
    where: {
      examId_markType: { examId, markType: data.markType },
    },
    update: {
      symbol: data.symbol,
      color: data.color,
      fontSize: data.fontSize,
      strokeWidth: data.strokeWidth,
    },
    create: {
      examId,
      ...data,
    },
  })
}

/** 複数の採点マーク設定を一括で作成または更新する（トランザクション内で実行） */
export async function bulkUpsertExamMarkingFormats(
  examId: string,
  formats: MarkingFormatData[]
) {
  const operations = formats.map((format) =>
    prisma.examMarkingFormat.upsert({
      where: {
        examId_markType: { examId, markType: format.markType },
      },
      update: {
        symbol: format.symbol,
        color: format.color,
        fontSize: format.fontSize,
        strokeWidth: format.strokeWidth,
      },
      create: {
        examId,
        ...format,
      },
    })
  )
  return prisma.$transaction(operations)
}

/** 指定マーク種別の採点マーク設定を削除する */
export async function deleteExamMarkingFormat(
  examId: string,
  markType: string
) {
  return prisma.examMarkingFormat.deleteMany({
    where: { examId, markType },
  })
}

// =============================================================================
// ExamExportSettings（エクスポート設定）
// =============================================================================

/** 試験のエクスポート設定をJSONパースして取得する（未設定またはパース失敗時はnull） */
export async function getExamExportSettings(examId: string) {
  const settings = await prisma.examExportSettings.findUnique({
    where: { examId },
  })
  if (!settings) return null
  try {
    return JSON.parse(settings.settingsJson)
  } catch {
    return null
  }
}

/** エクスポート設定をJSON文字列として作成または更新する */
export async function upsertExamExportSettings(
  examId: string,
  settings: Record<string, unknown>
) {
  const settingsJson = JSON.stringify(settings)
  return prisma.examExportSettings.upsert({
    where: { examId },
    update: { settingsJson },
    create: { examId, settingsJson },
  })
}

/** 試験のエクスポート設定を削除する */
export async function deleteExamExportSettings(examId: string) {
  return prisma.examExportSettings.deleteMany({
    where: { examId },
  })
}
