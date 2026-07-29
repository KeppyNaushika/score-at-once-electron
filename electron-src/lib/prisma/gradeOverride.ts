/**
 * GradeOverride（成績ラベル上書き）のPrisma操作関数
 */

import { recordAuditLog } from "./auditLog"
import { resolveGradeScope } from "./auditScope"
import prisma from "./client"

/**
 * 上書きを upsert。対象は生徒×評価項目で、gradeItemId は NOT NULL なので
 * 複合uniqueをそのまま使える（NULL が unique 制約をすり抜ける問題は起きない）。
 */
export async function upsertGradeOverride(data: {
  gradeId: string
  studentId: string
  gradeItemId: string
  overrideLabel: string
}) {
  try {
    const result = await prisma.gradeOverride.upsert({
      where: {
        gradeId_studentId_gradeItemId: {
          gradeId: data.gradeId,
          studentId: data.studentId,
          gradeItemId: data.gradeItemId,
        },
      },
      create: {
        gradeId: data.gradeId,
        studentId: data.studentId,
        gradeItemId: data.gradeItemId,
        overrideLabel: data.overrideLabel,
      },
      update: { overrideLabel: data.overrideLabel },
    })

    const scope = await resolveGradeScope(data.gradeId)
    await recordAuditLog({
      action: "grade.override.update",
      entityType: "GradeOverride",
      entityId: result.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
    })

    return { success: true, override: result }
  } catch (error) {
    console.error("Error upserting grade override:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 上書きを削除（自動計算に戻す）
 */
export async function deleteGradeOverride(data: {
  gradeId: string
  studentId: string
  gradeItemId: string
}) {
  try {
    const existing = await prisma.gradeOverride.findUnique({
      where: {
        gradeId_studentId_gradeItemId: {
          gradeId: data.gradeId,
          studentId: data.studentId,
          gradeItemId: data.gradeItemId,
        },
      },
    })
    if (existing) {
      await prisma.gradeOverride.delete({ where: { id: existing.id } })

      const scope = await resolveGradeScope(data.gradeId)
      await recordAuditLog({
        action: "grade.override.delete",
        entityType: "GradeOverride",
        entityId: existing.id,
        scopeId: scope.scopeId,
        scopeLabel: scope.scopeLabel,
      })
    }
    return { success: true }
  } catch (error) {
    console.error("Error deleting grade override:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
