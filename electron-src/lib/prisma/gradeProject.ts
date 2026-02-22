/**
 * GradeProject（成績算出プロジェクト）のPrisma操作関数
 */

import prisma from "./client"

/** Prisma Decimal等の非シリアライズ型をプレーン値に変換 */
function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

/** DataSourceのestimationSourceIds (JSON string) を配列にデシリアライズ */
function deserializeDataSources<T extends { gradeItems?: unknown[] }>(
  data: T
): T {
  if (!data || !Array.isArray((data as Record<string, unknown>).gradeItems))
    return data
  const gradeItems = (data as Record<string, unknown[]>).gradeItems as Array<{
    dataSources?: Array<Record<string, unknown>>
  }>
  for (const gi of gradeItems) {
    if (!Array.isArray(gi.dataSources)) continue
    for (const ds of gi.dataSources) {
      if (typeof ds.estimationSourceIds === "string") {
        try {
          ds.estimationSourceIds = JSON.parse(ds.estimationSourceIds as string)
        } catch {
          ds.estimationSourceIds = []
        }
      }
    }
  }
  return data
}

const gradeItemInclude = {
  dataSources: {
    include: {
      examProject: { select: { id: true, examName: true, examDate: true } },
      subtotal: { select: { id: true, name: true, order: true } },
      cropRegion: { select: { id: true, label: true, points: true } },
      _count: { select: { manualScores: true } },
    },
    orderBy: { order: "asc" as const },
  },
}

/**
 * 全成績算出プロジェクトを取得
 */
export async function getAllGradeProjects() {
  try {
    const gradeProjects = await prisma.gradeProject.findMany({
      include: {
        gradeProjectClasses: {
          include: { class: true },
          orderBy: { order: "asc" },
        },
        gradeItems: {
          include: gradeItemInclude,
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            gradeItems: true,
            gradeProjectStudents: true,
            boundarySets: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })
    return {
      success: true,
      gradeProjects: gradeProjects.map((gp) =>
        deserializeDataSources(serialize(gp))
      ),
    }
  } catch (error) {
    console.error("Error getting grade projects:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * IDで成績算出プロジェクトを取得
 */
export async function getGradeProjectById(id: string) {
  try {
    const gradeProject = await prisma.gradeProject.findUnique({
      where: { id },
      include: {
        gradeProjectClasses: {
          include: { class: true },
          orderBy: { order: "asc" },
        },
        gradeItems: {
          include: gradeItemInclude,
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            gradeItems: true,
            gradeProjectStudents: true,
            boundarySets: true,
          },
        },
      },
    })
    if (!gradeProject) {
      return { success: false, error: "Grade project not found" }
    }
    return {
      success: true,
      gradeProject: deserializeDataSources(serialize(gradeProject)),
    }
  } catch (error) {
    console.error("Error getting grade project:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 成績算出プロジェクトを作成
 */
export async function createGradeProject(data: {
  name: string
  description?: string
  referenceDate?: string | null
}) {
  try {
    const gradeProject = await prisma.gradeProject.create({
      data: {
        name: data.name,
        description: data.description,
        referenceDate: data.referenceDate ? new Date(data.referenceDate) : null,
      },
      include: {
        gradeProjectClasses: {
          include: { class: true },
          orderBy: { order: "asc" },
        },
        gradeItems: {
          include: gradeItemInclude,
          orderBy: { order: "asc" },
        },
      },
    })
    return {
      success: true,
      gradeProject: deserializeDataSources(serialize(gradeProject)),
    }
  } catch (error) {
    console.error("Error creating grade project:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 成績算出プロジェクトを更新
 */
export async function updateGradeProject(
  id: string,
  data: {
    name?: string
    description?: string
    referenceDate?: string | null
  }
) {
  try {
    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined)
      updateData.description = data.description
    if (data.referenceDate !== undefined) {
      updateData.referenceDate = data.referenceDate
        ? new Date(data.referenceDate)
        : null
    }
    const gradeProject = await prisma.gradeProject.update({
      where: { id },
      data: updateData,
      include: {
        gradeProjectClasses: {
          include: { class: true },
          orderBy: { order: "asc" },
        },
        gradeItems: {
          include: gradeItemInclude,
          orderBy: { order: "asc" },
        },
      },
    })
    return {
      success: true,
      gradeProject: deserializeDataSources(serialize(gradeProject)),
    }
  } catch (error) {
    console.error("Error updating grade project:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 成績算出プロジェクトを削除
 */
export async function deleteGradeProject(id: string) {
  try {
    await prisma.gradeProject.delete({ where: { id } })
    return { success: true }
  } catch (error) {
    console.error("Error deleting grade project:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// =============================================================================
// GradeProjectExportSettings（エクスポート設定）
// =============================================================================

export async function getGradeProjectExportSettings(gradeProjectId: string) {
  const settings = await prisma.gradeProjectExportSettings.findUnique({
    where: { gradeProjectId },
  })
  if (!settings) return null
  try {
    return JSON.parse(settings.settingsJson)
  } catch {
    return null
  }
}

export async function upsertGradeProjectExportSettings(
  gradeProjectId: string,
  settings: Record<string, unknown>
) {
  const settingsJson = JSON.stringify(settings)
  return prisma.gradeProjectExportSettings.upsert({
    where: { gradeProjectId },
    update: { settingsJson },
    create: { gradeProjectId, settingsJson },
  })
}
