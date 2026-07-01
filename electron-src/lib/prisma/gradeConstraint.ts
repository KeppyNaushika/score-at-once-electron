/**
 * GradeConstraint（観点間の制約ルール）のPrisma操作関数
 */

import type { GradeConstraintInput } from "../../../src/types/grade.types"
import { recordAuditLog } from "./auditLog"
import { resolveGradeScope } from "./auditScope"
import prisma from "./client"

/**
 * 成績の全制約ルールを取得（order昇順）
 */
export async function getGradeConstraints(gradeId: string) {
  try {
    const constraints = await prisma.gradeConstraint.findMany({
      where: { gradeId },
      orderBy: { order: "asc" },
    })
    return { success: true, constraints }
  } catch (error) {
    console.error("Error getting grade constraints:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 制約ルールを新規作成
 */
export async function createGradeConstraint(data: {
  gradeId: string
  constraint: GradeConstraintInput
}) {
  try {
    const created = await prisma.gradeConstraint.create({
      data: {
        gradeId: data.gradeId,
        name: data.constraint.name,
        kind: data.constraint.kind,
        config: data.constraint.config,
        expression: data.constraint.expression,
        color: data.constraint.color,
        message: data.constraint.message,
        enabled: data.constraint.enabled,
        order: data.constraint.order,
      },
    })

    const scope = await resolveGradeScope(data.gradeId)
    await recordAuditLog({
      action: "grade.constraint.create",
      entityType: "GradeConstraint",
      entityId: created.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
    })

    return { success: true, constraint: created }
  } catch (error) {
    console.error("Error creating grade constraint:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 制約ルールを更新
 */
export async function updateGradeConstraint(data: {
  id: string
  constraint: Partial<GradeConstraintInput>
}) {
  try {
    const updated = await prisma.gradeConstraint.update({
      where: { id: data.id },
      data: {
        name: data.constraint.name,
        kind: data.constraint.kind,
        config: data.constraint.config,
        expression: data.constraint.expression,
        color: data.constraint.color,
        message: data.constraint.message,
        enabled: data.constraint.enabled,
        order: data.constraint.order,
      },
    })

    const scope = await resolveGradeScope(updated.gradeId)
    await recordAuditLog({
      action: "grade.constraint.update",
      entityType: "GradeConstraint",
      entityId: updated.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
    })

    return { success: true, constraint: updated }
  } catch (error) {
    console.error("Error updating grade constraint:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 制約ルールを削除
 */
export async function deleteGradeConstraint(id: string) {
  try {
    const existing = await prisma.gradeConstraint.findUnique({ where: { id } })
    if (existing) {
      await prisma.gradeConstraint.delete({ where: { id } })

      const scope = await resolveGradeScope(existing.gradeId)
      await recordAuditLog({
        action: "grade.constraint.delete",
        entityType: "GradeConstraint",
        entityId: id,
        scopeId: scope.scopeId,
        scopeLabel: scope.scopeLabel,
      })
    }
    return { success: true }
  } catch (error) {
    console.error("Error deleting grade constraint:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
