/**
 * GradeOverride（成績ラベル上書き）のPrisma操作関数
 *
 * 上書きの主語は「その成績の対象者」（GradeStudent）であり、人（Student）ではない。
 * 名簿に載っていない生徒の上書きは書けない（FK が拒否する）。
 */

import type { GradeCellTarget } from "../../../src/types/grade.types"
import { recordAuditLog } from "./auditLog"
import { resolveGradeScope } from "./auditScope"
import prisma from "./client"
import { assertGradeCellsInSameGrade } from "./gradeScopeGuard"

/** 監査ログのスコープ用に、対象者から所属する成績を引く */
async function resolveGradeIdOf(
  gradeStudentId: string
): Promise<string | null> {
  const gradeStudent = await prisma.gradeStudent.findUnique({
    where: { id: gradeStudentId },
    select: { gradeId: true },
  })
  return gradeStudent?.gradeId ?? null
}

/**
 * 上書きを upsert。対象は対象者×評価項目で、どちらも NOT NULL なので
 * 複合uniqueをそのまま使える（NULL が unique 制約をすり抜ける問題は起きない）。
 */
export async function upsertGradeOverride(
  data: GradeCellTarget & { overrideLabel: string }
) {
  try {
    // 対象者と評価項目が同じ成績のものであることを書き込み前に検査する。
    // FK は「それぞれが実在すること」しか保証しない。
    await assertGradeCellsInSameGrade([data])

    const result = await prisma.gradeOverride.upsert({
      where: {
        gradeStudentId_gradeItemId: {
          gradeStudentId: data.gradeStudentId,
          gradeItemId: data.gradeItemId,
        },
      },
      create: {
        gradeStudentId: data.gradeStudentId,
        gradeItemId: data.gradeItemId,
        overrideLabel: data.overrideLabel,
      },
      update: { overrideLabel: data.overrideLabel },
    })

    const gradeId = await resolveGradeIdOf(data.gradeStudentId)
    if (gradeId) {
      const scope = await resolveGradeScope(gradeId)
      await recordAuditLog({
        action: "grade.override.update",
        entityType: "GradeOverride",
        entityId: result.id,
        scopeId: scope.scopeId,
        scopeLabel: scope.scopeLabel,
      })
    }

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
export async function deleteGradeOverride(target: GradeCellTarget) {
  try {
    const existing = await prisma.gradeOverride.findUnique({
      where: {
        gradeStudentId_gradeItemId: {
          gradeStudentId: target.gradeStudentId,
          gradeItemId: target.gradeItemId,
        },
      },
    })
    if (existing) {
      await prisma.gradeOverride.delete({ where: { id: existing.id } })

      const gradeId = await resolveGradeIdOf(target.gradeStudentId)
      if (gradeId) {
        const scope = await resolveGradeScope(gradeId)
        await recordAuditLog({
          action: "grade.override.delete",
          entityType: "GradeOverride",
          entityId: existing.id,
          scopeId: scope.scopeId,
          scopeLabel: scope.scopeLabel,
        })
      }
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
