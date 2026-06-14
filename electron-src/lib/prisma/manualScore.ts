/**
 * ManualScore（外部成績・手動入力スコア）のPrisma操作関数
 */

import { recordAuditLog } from "./auditLog"
import { resolveGradeScopeByDataSource } from "./auditScope"
import prisma from "./client"

/** Prisma Decimal等の非シリアライズ型をプレーン値に変換 */
function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

/**
 * データソースの全手動スコアを取得
 */
export async function getManualScoresByDataSourceId(gradeDataSourceId: string) {
  try {
    const manualScores = await prisma.manualScore.findMany({
      where: { gradeDataSourceId },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            lastName: true,
            firstName: true,
          },
        },
      },
      orderBy: { student: { studentNumber: "asc" } },
    })
    return { success: true, manualScores: serialize(manualScores) }
  } catch (error) {
    console.error("Error getting manual scores:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 手動スコアを一括更新（upsert）
 */
export async function batchUpsertManualScores(
  scores: {
    gradeDataSourceId: string
    studentId: string
    score: number | null
  }[]
) {
  try {
    await prisma.$transaction(
      scores.map((s) =>
        prisma.manualScore.upsert({
          where: {
            gradeDataSourceId_studentId: {
              gradeDataSourceId: s.gradeDataSourceId,
              studentId: s.studentId,
            },
          },
          create: {
            gradeDataSourceId: s.gradeDataSourceId,
            studentId: s.studentId,
            score: s.score,
          },
          update: {
            score: s.score,
          },
        })
      )
    )

    // 監査ログ: 手動スコアの一括更新（1件にまとめて記録）
    if (scores.length > 0) {
      const scope = await resolveGradeScopeByDataSource(
        scores[0].gradeDataSourceId
      )
      await recordAuditLog({
        action: "grade.manual_score.update",
        entityType: "ManualScore",
        entityId: scores[0].gradeDataSourceId,
        scopeId: scope.scopeId,
        scopeLabel: scope.scopeLabel,
        summary: `手動スコアを更新しました（${scores.length}件）`,
        extra: { count: scores.length },
      })
    }

    return { success: true }
  } catch (error) {
    console.error("Error batch upserting manual scores:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
