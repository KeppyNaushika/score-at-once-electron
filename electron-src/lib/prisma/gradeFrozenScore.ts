/**
 * GradeFrozenScore（成績値の確定・凍結）のPrisma操作関数。
 *
 * 確定は「自動算出 → 手動上書きで調整 → その実効値で固定」という評価フローを写したもので、
 * 確定操作の時点で calculateGrades が返す実効値をそのまま行として保存する。以後は参照資料
 * （試験スコア・試験外成績資料）や境界設定を変更しても、確定済みの値は動かない。
 *
 * 確定値の取り込みには applyFrozen: false で算出したライブ値を使う。既定の算出は確定値を
 * 最優先で返すため、そのまま読むと「再確定」が確定値自身を焼き直すだけになってしまう。
 */

import { Decimal } from "@prisma/client/runtime/client"

import type { GradeCellTarget } from "../../../src/types/grade.types"
import { calculateGrades } from "../shared/calculations/gradeCalculator"
import { recordAuditLog } from "./auditLog"
import { resolveGradeScope } from "./auditScope"
import prisma from "./client"

interface FreezeGradeScoresResult {
  success: boolean
  /** 確定した（＝書き込んだ）セル数 */
  frozenCount?: number
  error?: string
}

interface UnfreezeGradeScoresResult {
  success: boolean
  /** 解除した確定行の件数 */
  unfrozenCount?: number
  error?: string
}

/** 対象セルの同定キー。id の組でキーし、行・列の並び順には依存しない */
const targetKey = (target: GradeCellTarget): string =>
  `${target.gradeStudentId}:${target.gradeItemId}`

/**
 * 成績値を確定（凍結）する。
 *
 * targets 未指定なら Grade 全体（全対象者 × 全評価項目）を一括で確定する。
 * 既に確定済みのセルを含めて指定した場合は、その時点のライブ値で確定し直す（再確定）。
 * 除外セル（GradeItemExclusion）は値を持たないため確定対象から外す。
 */
export async function freezeGradeScores(options: {
  gradeId: string
  targets?: GradeCellTarget[]
  frozenByUserId?: string | null
}): Promise<FreezeGradeScoresResult> {
  const { gradeId, targets, frozenByUserId = null } = options
  try {
    // 確定値を適用しないライブ算出（自動算出 ＋ 手動上書き）を取り込む。
    const calculation = await calculateGrades(gradeId, { applyFrozen: false })
    if (!calculation.success || !calculation.result) {
      return {
        success: false,
        error: calculation.error ?? "成績の算出に失敗しました",
      }
    }

    const requestedKeys =
      targets !== undefined ? new Set(targets.map(targetKey)) : null

    const rows: {
      gradeStudentId: string
      gradeItemId: string
      weightedScore: Decimal | null
      weightedMaxScore: Decimal
      percentage: Decimal | null
      gradeLabel: string | null
      frozenByUserId: string | null
      frozenAt: Date
    }[] = []
    const frozenAt = new Date()

    for (const student of calculation.result.students) {
      for (const gradeItemResult of student.gradeItemResults) {
        const target: GradeCellTarget = {
          gradeStudentId: student.gradeStudentId,
          gradeItemId: gradeItemResult.gradeItemId,
        }
        if (requestedKeys !== null && !requestedKeys.has(targetKey(target))) {
          continue
        }
        // 除外セルは値そのものが無いので確定しない（解除後に再び算出値が出る）
        if (gradeItemResult.isExcluded) continue

        rows.push({
          gradeStudentId: target.gradeStudentId,
          gradeItemId: target.gradeItemId,
          weightedScore:
            gradeItemResult.weightedScore !== null
              ? new Decimal(gradeItemResult.weightedScore)
              : null,
          weightedMaxScore: new Decimal(gradeItemResult.weightedMaxScore),
          percentage:
            gradeItemResult.percentage !== null
              ? new Decimal(gradeItemResult.percentage)
              : null,
          gradeLabel: gradeItemResult.gradeLabel,
          frozenByUserId,
          frozenAt,
        })
      }
    }

    if (targets !== undefined && targets.length === 0) {
      return { success: true, frozenCount: 0 }
    }

    // 削除条件は「書き込む行」ではなく「確定を要求された範囲」から作る。
    // 除外セルは rows に入らないので、rows から作ると確定→除外→再確定の後に
    // 古い確定行が残り、除外を解除した瞬間に過去の値が甦ってしまう。
    const deleteWhere =
      targets === undefined
        ? { gradeStudent: { gradeId } }
        : {
            gradeStudent: { gradeId },
            OR: targets.map((target) => ({
              gradeStudentId: target.gradeStudentId,
              gradeItemId: target.gradeItemId,
            })),
          }

    // 再確定を上書きではなく「消して入れ直す」で表現する。
    // unique(gradeStudentId, gradeItemId) の1行1セルなので、対象範囲を削除してから
    // 作り直せば新規確定・再確定のどちらも同じ経路で扱える。
    await prisma.$transaction(async (tx) => {
      await tx.gradeFrozenScore.deleteMany({ where: deleteWhere })
      if (rows.length > 0) {
        await tx.gradeFrozenScore.createMany({ data: rows })
      }
    })

    const scope = await resolveGradeScope(gradeId)
    await recordAuditLog({
      action: "grade.frozenScore.freeze",
      // 呼び出し側が操作者を渡していなければ認証ストアからの自動補完に任せる
      // （null を明示すると「システム操作」として actor 無しで記録されてしまう）
      userId: frozenByUserId ?? undefined,
      entityType: "GradeFrozenScore",
      entityId: gradeId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: `${rows.length}件の成績値を確定しました`,
      extra: { cellCount: rows.length, scopeKind: targets ? "cells" : "all" },
    })

    return { success: true, frozenCount: rows.length }
  } catch (error) {
    console.error("Error freezing grade scores:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 成績値の確定を解除する（リアルタイム算出値へ戻す）。
 * targets 未指定なら Grade 全体の確定を解除する。
 */
export async function unfreezeGradeScores(options: {
  gradeId: string
  targets?: GradeCellTarget[]
  userId?: string | null
}): Promise<UnfreezeGradeScoresResult> {
  const { gradeId, targets, userId = null } = options
  try {
    if (targets !== undefined && targets.length === 0) {
      return { success: true, unfrozenCount: 0 }
    }

    const deleted = await prisma.gradeFrozenScore.deleteMany({
      where: {
        gradeStudent: { gradeId },
        ...(targets !== undefined
          ? {
              OR: targets.map((target) => ({
                gradeStudentId: target.gradeStudentId,
                gradeItemId: target.gradeItemId,
              })),
            }
          : {}),
      },
    })

    if (deleted.count > 0) {
      const scope = await resolveGradeScope(gradeId)
      await recordAuditLog({
        action: "grade.frozenScore.unfreeze",
        userId: userId ?? undefined,
        entityType: "GradeFrozenScore",
        entityId: gradeId,
        scopeId: scope.scopeId,
        scopeLabel: scope.scopeLabel,
        summary: `${deleted.count}件の成績値の確定を解除しました`,
        extra: {
          cellCount: deleted.count,
          scopeKind: targets ? "cells" : "all",
        },
      })
    }

    return { success: true, unfrozenCount: deleted.count }
  } catch (error) {
    console.error("Error unfreezing grade scores:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
