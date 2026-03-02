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

export async function getExamMarkingFormats(examId: string) {
  return prisma.examMarkingFormat.findMany({
    where: { examId },
  })
}

export async function getExamMarkingFormat(examId: string, markType: string) {
  return prisma.examMarkingFormat.findUnique({
    where: {
      examId_markType: { examId, markType },
    },
  })
}

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

export async function deleteExamExportSettings(examId: string) {
  return prisma.examExportSettings.deleteMany({
    where: { examId },
  })
}
