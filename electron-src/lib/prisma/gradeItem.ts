/**
 * GradeItem（評価項目）のPrisma操作関数
 */

import { recordAuditLog } from "./auditLog"
import { resolveGradeScope, resolveGradeScopeByItem } from "./auditScope"
import prisma from "./client"

/** Prisma Decimal等の非シリアライズ型をプレーン値に変換 */
function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

/**
 * GradeItem一覧を取得（dataSources含む）
 */
export async function getGradeItemsByExamId(gradeId: string) {
  try {
    const gradeItems = await prisma.gradeItem.findMany({
      where: { gradeId },
      include: {
        dataSources: {
          include: {
            exam: {
              select: { id: true, examName: true, examDate: true },
            },
            subtotal: { select: { id: true, name: true, order: true } },
            cropRegion: { select: { id: true, label: true, points: true } },
            courseworkItem: {
              include: {
                coursework: { select: { id: true, name: true } },
                letterScales: { orderBy: { order: "asc" } },
                _count: { select: { scores: true, gradeDataSources: true } },
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    })
    return { success: true, gradeItems: serialize(gradeItems) }
  } catch (error) {
    console.error("Error getting grade items:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * GradeItemを作成（order自動計算）
 */
export async function createGradeItem(data: { gradeId: string; name: string }) {
  try {
    const maxOrder = await prisma.gradeItem.aggregate({
      where: { gradeId: data.gradeId },
      _max: { order: true },
    })
    const nextOrder = (maxOrder._max.order ?? -1) + 1

    const gradeItem = await prisma.gradeItem.create({
      data: {
        gradeId: data.gradeId,
        name: data.name,
        order: nextOrder,
      },
      include: {
        dataSources: {
          include: {
            exam: {
              select: { id: true, examName: true, examDate: true },
            },
            subtotal: { select: { id: true, name: true, order: true } },
            cropRegion: { select: { id: true, label: true, points: true } },
            courseworkItem: {
              include: {
                coursework: { select: { id: true, name: true } },
                letterScales: { orderBy: { order: "asc" } },
                _count: { select: { scores: true, gradeDataSources: true } },
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    })

    const scope = await resolveGradeScope(data.gradeId)
    await recordAuditLog({
      action: "grade.item.create",
      entityType: "GradeItem",
      entityId: gradeItem.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      target: gradeItem.name,
    })

    return { success: true, gradeItem: serialize(gradeItem) }
  } catch (error) {
    console.error("Error creating grade item:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * GradeItemを更新
 */
export async function updateGradeItem(id: string, data: { name?: string }) {
  try {
    const gradeItem = await prisma.gradeItem.update({
      where: { id },
      data,
      include: {
        dataSources: {
          include: {
            exam: {
              select: { id: true, examName: true, examDate: true },
            },
            subtotal: { select: { id: true, name: true, order: true } },
            cropRegion: { select: { id: true, label: true, points: true } },
            courseworkItem: {
              include: {
                coursework: { select: { id: true, name: true } },
                letterScales: { orderBy: { order: "asc" } },
                _count: { select: { scores: true, gradeDataSources: true } },
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    })

    const scope = await resolveGradeScope(gradeItem.gradeId)
    await recordAuditLog({
      action: "grade.item.update",
      entityType: "GradeItem",
      entityId: gradeItem.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      target: gradeItem.name,
    })

    return { success: true, gradeItem: serialize(gradeItem) }
  } catch (error) {
    console.error("Error updating grade item:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * GradeItemを削除（Cascadeでdatasonrces も削除）
 */
export async function deleteGradeItem(id: string) {
  try {
    const before = await prisma.gradeItem.findUnique({
      where: { id },
      select: { name: true, gradeId: true },
    })

    await prisma.gradeItem.delete({ where: { id } })

    const scope = before ? await resolveGradeScope(before.gradeId) : null
    await recordAuditLog({
      action: "grade.item.delete",
      entityType: "GradeItem",
      entityId: id,
      scopeId: scope?.scopeId ?? null,
      scopeLabel: scope?.scopeLabel ?? null,
      target: before?.name ?? null,
    })

    return { success: true }
  } catch (error) {
    console.error("Error deleting grade item:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * GradeItemの並び順を一括更新
 */
export async function reorderGradeItems(
  items: { id: string; order: number }[]
) {
  try {
    await prisma.$transaction(
      items.map((item) =>
        prisma.gradeItem.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    )

    if (items.length > 0) {
      const scope = await resolveGradeScopeByItem(items[0].id)
      await recordAuditLog({
        action: "grade.item.reorder",
        entityType: "GradeItem",
        entityId: scope.scopeId ?? items[0].id,
        scopeId: scope.scopeId,
        scopeLabel: scope.scopeLabel,
        coalesceKey: `grade_item_reorder:${scope.scopeId ?? items[0].id}`,
      })
    }

    return { success: true }
  } catch (error) {
    console.error("Error reordering grade items:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
