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
 *
 * 各フィールドは optional。指定されたフィールドのみ更新する（セル単位編集対応）。
 * score / letterValue / adjustment / adjustmentReason / comment を扱う。
 */
export async function batchUpsertManualScores(
  scores: {
    gradeDataSourceId: string
    studentId: string
    score?: number | null
    letterValue?: string | null
    adjustment?: number | null
    adjustmentReason?: string | null
    comment?: string | null
  }[]
) {
  try {
    await prisma.$transaction(
      scores.map((s) => {
        // 指定されたフィールドのみを更新対象に含める
        const fields: {
          score?: number | null
          letterValue?: string | null
          adjustment?: number | null
          adjustmentReason?: string | null
          comment?: string | null
        } = {}
        if (s.score !== undefined) fields.score = s.score
        if (s.letterValue !== undefined) fields.letterValue = s.letterValue
        if (s.adjustment !== undefined) fields.adjustment = s.adjustment
        if (s.adjustmentReason !== undefined)
          fields.adjustmentReason = s.adjustmentReason
        if (s.comment !== undefined) fields.comment = s.comment

        return prisma.manualScore.upsert({
          where: {
            gradeDataSourceId_studentId: {
              gradeDataSourceId: s.gradeDataSourceId,
              studentId: s.studentId,
            },
          },
          create: {
            gradeDataSourceId: s.gradeDataSourceId,
            studentId: s.studentId,
            ...fields,
          },
          update: fields,
        })
      })
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
