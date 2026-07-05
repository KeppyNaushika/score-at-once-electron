/**
 * Grade（成績算出試験）のPrisma操作関数
 */

import { diffFields, recordAuditLog } from "./auditLog"
import prisma from "./client"
import {
  gradeItemWithDataSourcesInclude,
  hydrateGrade,
} from "./gradeDataSource"
import { serializePrisma } from "./serializePrisma"

/**
 * 全成績算出試験を取得
 */
export async function getAllGrades() {
  try {
    const grades = await prisma.grade.findMany({
      include: {
        gradeClassrooms: {
          include: { classroom: true },
          orderBy: { order: "asc" },
        },
        gradeItems: {
          include: gradeItemWithDataSourcesInclude,
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            gradeItems: true,
            gradeStudents: true,
            boundarySets: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })
    return {
      success: true,
      grades: grades.map((grade) => hydrateGrade(serializePrisma(grade))),
    }
  } catch (error) {
    console.error("Error getting grade exams:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * IDで成績算出試験を取得
 */
export async function getGradeById(id: string) {
  try {
    const grade = await prisma.grade.findUnique({
      where: { id },
      include: {
        gradeClassrooms: {
          include: { classroom: true },
          orderBy: { order: "asc" },
        },
        gradeItems: {
          include: gradeItemWithDataSourcesInclude,
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            gradeItems: true,
            gradeStudents: true,
            boundarySets: true,
          },
        },
      },
    })
    if (!grade) {
      return { success: false, error: "Grade exam not found" }
    }
    return {
      success: true,
      grade: hydrateGrade(serializePrisma(grade)),
    }
  } catch (error) {
    console.error("Error getting grade exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 成績算出試験を作成
 */
export async function createGrade(data: {
  name: string
  description?: string
  referenceDate?: string | null
}) {
  try {
    const grade = await prisma.grade.create({
      data: {
        name: data.name,
        description: data.description,
        referenceDate: data.referenceDate ? new Date(data.referenceDate) : null,
      },
      include: {
        gradeClassrooms: {
          include: { classroom: true },
          orderBy: { order: "asc" },
        },
        gradeItems: {
          include: gradeItemWithDataSourcesInclude,
          orderBy: { order: "asc" },
        },
      },
    })

    await recordAuditLog({
      action: "grade.create",
      entityType: "Grade",
      entityId: grade.id,
      scopeId: grade.id,
      scopeLabel: grade.name,
      target: grade.name,
    })

    return {
      success: true,
      grade: hydrateGrade(serializePrisma(grade)),
    }
  } catch (error) {
    console.error("Error creating grade exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 成績算出試験を更新
 */
export async function updateGrade(
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
    const before = await prisma.grade.findUnique({
      where: { id },
      select: { name: true, description: true },
    })
    const grade = await prisma.grade.update({
      where: { id },
      data: updateData,
      include: {
        gradeClassrooms: {
          include: { classroom: true },
          orderBy: { order: "asc" },
        },
        gradeItems: {
          include: gradeItemWithDataSourcesInclude,
          orderBy: { order: "asc" },
        },
      },
    })

    await recordAuditLog({
      action: "grade.update",
      entityType: "Grade",
      entityId: grade.id,
      scopeId: grade.id,
      scopeLabel: grade.name,
      target: grade.name,
      changes: diffFields(
        before ?? undefined,
        { name: grade.name, description: grade.description },
        [
          { field: "name", label: "成績名" },
          { field: "description", label: "説明" },
        ]
      ),
    })

    return {
      success: true,
      grade: hydrateGrade(serializePrisma(grade)),
    }
  } catch (error) {
    console.error("Error updating grade exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 成績算出試験を削除
 */
export async function deleteGrade(id: string) {
  try {
    const before = await prisma.grade.findUnique({
      where: { id },
      select: { name: true },
    })
    await prisma.grade.delete({ where: { id } })

    await recordAuditLog({
      action: "grade.delete",
      entityType: "Grade",
      entityId: id,
      scopeId: id,
      scopeLabel: before?.name ?? null,
      target: before?.name ?? null,
    })

    return { success: true }
  } catch (error) {
    console.error("Error deleting grade exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// =============================================================================
// GradeExportSettings（エクスポート設定）
// =============================================================================

/** 成績算出試験のエクスポート設定をJSON形式で取得する */
export async function getGradeExportSettings(gradeId: string) {
  const settings = await prisma.gradeExportSettings.findUnique({
    where: { gradeId },
  })
  if (!settings) return null
  try {
    return JSON.parse(settings.settingsJson)
  } catch {
    return null
  }
}

/** 成績算出試験のエクスポート設定を作成または更新する（JSON文字列として保存） */
export async function upsertGradeExportSettings(
  gradeId: string,
  settings: Record<string, unknown>
) {
  const settingsJson = JSON.stringify(settings)
  return prisma.gradeExportSettings.upsert({
    where: { gradeId },
    update: { settingsJson },
    create: { gradeId, settingsJson },
  })
}
