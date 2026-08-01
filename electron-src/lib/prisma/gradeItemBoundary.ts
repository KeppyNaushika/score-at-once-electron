/**
 * GradeItemBoundary（成績境界）のPrisma操作関数
 *
 * 境界の有無は行の有無そのもの。かつては属性を持たない容器 GradeBoundarySet を挟んでおり、
 * 境界を全行消してもセット行が生き残って「境界は無いのに設定済み」になっていた。
 *
 * 取得の関数は無い。境界は評価項目の子として `gradeItemWithDataSourcesInclude` に同梱され、
 * `getGradeById` / `getAllGrades` が行のまま返す。
 */

import type { Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import { resolveGradeScopeByItem } from "./auditScope"
import prisma from "./client"

/**
 * 評価項目の境界を丸ごと置き換える（全削除→再作成）。
 * 空配列を渡せば境界の無い状態になる。
 */
export async function replaceGradeItemBoundaries(data: {
  gradeItemId: string
  boundaries: { label: string; minPercentage: number; order: number }[]
}) {
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.gradeItemBoundary.deleteMany({
        where: { gradeItemId: data.gradeItemId },
      })

      if (data.boundaries.length > 0) {
        await tx.gradeItemBoundary.createMany({
          data: data.boundaries.map((boundary) => ({
            gradeItemId: data.gradeItemId,
            label: boundary.label,
            minPercentage: boundary.minPercentage,
            order: boundary.order,
          })),
        })
      }
    })

    const scope = await resolveGradeScopeByItem(data.gradeItemId)
    await recordAuditLog({
      action: "grade.boundary.update",
      entityType: "GradeItemBoundary",
      entityId: data.gradeItemId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
    })

    return { success: true }
  } catch (error) {
    console.error("Error replacing grade item boundaries:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 評価項目の境界をすべて削除する。
 *
 * 空配列での置き換えと結果は同じだが、教員が確認ダイアログを経て明示的に消した操作として
 * 監査ログへ別アクションで残す（自動保存による更新と混ざらないようにする）。
 */
export async function deleteGradeItemBoundaries(gradeItemId: string) {
  try {
    await prisma.gradeItemBoundary.deleteMany({ where: { gradeItemId } })

    const scope = await resolveGradeScopeByItem(gradeItemId)
    await recordAuditLog({
      action: "grade.boundary.delete",
      entityType: "GradeItemBoundary",
      entityId: gradeItemId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
    })

    return { success: true }
  } catch (error) {
    console.error("Error deleting grade item boundaries:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
