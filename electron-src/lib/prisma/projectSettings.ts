/**
 * プロジェクト設定関連のPrisma操作関数
 */

import prisma from "./client"

// =============================================================================
// ProjectMarkingFormat（採点マーク設定）
// =============================================================================

export interface MarkingFormatData {
  markType: string
  symbol: string
  color: string
  fontSize?: number | null
  strokeWidth?: number | null
}

export async function getProjectMarkingFormats(projectId: string) {
  return prisma.projectMarkingFormat.findMany({
    where: { projectId },
  })
}

export async function getProjectMarkingFormat(projectId: string, markType: string) {
  return prisma.projectMarkingFormat.findUnique({
    where: {
      projectId_markType: { projectId, markType },
    },
  })
}

export async function upsertProjectMarkingFormat(
  projectId: string,
  data: MarkingFormatData
) {
  return prisma.projectMarkingFormat.upsert({
    where: {
      projectId_markType: { projectId, markType: data.markType },
    },
    update: {
      symbol: data.symbol,
      color: data.color,
      fontSize: data.fontSize,
      strokeWidth: data.strokeWidth,
    },
    create: {
      projectId,
      ...data,
    },
  })
}

export async function bulkUpsertProjectMarkingFormats(
  projectId: string,
  formats: MarkingFormatData[]
) {
  const operations = formats.map((format) =>
    prisma.projectMarkingFormat.upsert({
      where: {
        projectId_markType: { projectId, markType: format.markType },
      },
      update: {
        symbol: format.symbol,
        color: format.color,
        fontSize: format.fontSize,
        strokeWidth: format.strokeWidth,
      },
      create: {
        projectId,
        ...format,
      },
    })
  )
  return prisma.$transaction(operations)
}

export async function deleteProjectMarkingFormat(projectId: string, markType: string) {
  return prisma.projectMarkingFormat.deleteMany({
    where: { projectId, markType },
  })
}

// =============================================================================
// ProjectExportSettings（エクスポート設定）
// =============================================================================

export async function getProjectExportSettings(projectId: string) {
  const settings = await prisma.projectExportSettings.findUnique({
    where: { projectId },
  })
  if (!settings) return null
  try {
    return JSON.parse(settings.settingsJson)
  } catch {
    return null
  }
}

export async function upsertProjectExportSettings(
  projectId: string,
  settings: Record<string, unknown>
) {
  const settingsJson = JSON.stringify(settings)
  return prisma.projectExportSettings.upsert({
    where: { projectId },
    update: { settingsJson },
    create: { projectId, settingsJson },
  })
}

export async function deleteProjectExportSettings(projectId: string) {
  return prisma.projectExportSettings.deleteMany({
    where: { projectId },
  })
}
