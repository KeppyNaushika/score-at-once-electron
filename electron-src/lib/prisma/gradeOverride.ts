/**
 * GradeOverride（成績ラベル上書き）のPrisma操作関数
 */

import type { Prisma } from "@prisma/client"

import prisma from "./client"

/**
 * プロジェクトの全上書きを取得
 */
export async function getGradeOverridesByProjectId(gradeProjectId: string) {
  try {
    const overrides = await prisma.gradeOverride.findMany({
      where: { gradeProjectId },
    })
    return { success: true, overrides }
  } catch (error) {
    console.error("Error getting grade overrides:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 上書きを upsert（findFirst + create/update パターン: SQLite の NULL 制約問題回避）
 */
export async function upsertGradeOverride(data: {
  gradeProjectId: string
  studentId: string
  targetType: string
  gradeItemId: string | null
  overrideLabel: string
}) {
  try {
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const existing = await tx.gradeOverride.findFirst({
          where: {
            gradeProjectId: data.gradeProjectId,
            studentId: data.studentId,
            targetType: data.targetType,
            gradeItemId: data.gradeItemId,
          },
        })

        if (existing) {
          return tx.gradeOverride.update({
            where: { id: existing.id },
            data: { overrideLabel: data.overrideLabel },
          })
        } else {
          return tx.gradeOverride.create({
            data: {
              gradeProjectId: data.gradeProjectId,
              studentId: data.studentId,
              targetType: data.targetType,
              gradeItemId: data.gradeItemId,
              overrideLabel: data.overrideLabel,
            },
          })
        }
      }
    )
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
  gradeProjectId: string
  studentId: string
  targetType: string
  gradeItemId: string | null
}) {
  try {
    const existing = await prisma.gradeOverride.findFirst({
      where: {
        gradeProjectId: data.gradeProjectId,
        studentId: data.studentId,
        targetType: data.targetType,
        gradeItemId: data.gradeItemId,
      },
    })
    if (existing) {
      await prisma.gradeOverride.delete({ where: { id: existing.id } })
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
