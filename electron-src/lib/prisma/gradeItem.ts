/**
 * GradeItem（評価項目）のPrisma操作関数
 */

import { recordAuditLog } from "./auditLog"
import { resolveGradeScope, resolveGradeScopeByItem } from "./auditScope"
import prisma from "./client"
import {
  gradeItemWithDataSourcesInclude,
  hydrateGradeItem,
  hydrateGradeItems,
} from "./gradeDataSource"
import { serializePrisma } from "./serializePrisma"

/**
 * GradeItem一覧を取得（dataSources含む）
 */
export async function getGradeItemsByExamId(gradeId: string) {
  const gradeItems = await prisma.gradeItem.findMany({
    where: { gradeId },
    include: gradeItemWithDataSourcesInclude,
    orderBy: { order: "asc" },
  })
  return hydrateGradeItems(serializePrisma(gradeItems))
}

/**
 * GradeItemを作成（order自動計算）
 */
export async function createGradeItem(data: { gradeId: string; name: string }) {
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
    include: gradeItemWithDataSourcesInclude,
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

  return hydrateGradeItem(serializePrisma(gradeItem))
}

/**
 * GradeItemを更新
 */
export async function updateGradeItem(id: string, data: { name?: string }) {
  const gradeItem = await prisma.gradeItem.update({
    where: { id },
    data,
    include: gradeItemWithDataSourcesInclude,
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

  return hydrateGradeItem(serializePrisma(gradeItem))
}

/**
 * GradeItemを削除（Cascadeでdatasonrces も削除）
 *
 * 集計対象にこの項目を含む制約ルールは先に無効化する。`GradeConstraintViewpoint` は
 * FK の Cascade で消えるため、放っておくと集計対象が黙って1つ減り、残った項目だけで
 * 平均を取って別の判定に化ける（issue #1063 で潰したのと同じ形の無言failure）。
 * 比較先（targetGradeItemId）は SetNull になり「評定が未選択」として検知されるので触らない。
 */
export async function deleteGradeItem(id: string) {
  const before = await prisma.gradeItem.findUnique({
    where: { id },
  })

  const disabledConstraintNames = await prisma.$transaction(async (tx) => {
    const affected = await tx.gradeConstraint.findMany({
      where: { viewpoints: { some: { gradeItemId: id } }, enabled: true },
    })
    // 理由は disabledReason へ。message は教員が書いた違反の説明で、結果表の
    // ツールチップに出るため汚さない。
    const reason = `評価項目「${before?.name ?? ""}」の削除で集計対象が変わるため無効化しました。再設定してください。`
    for (const constraint of affected) {
      await tx.gradeConstraint.update({
        where: { id: constraint.id },
        data: { enabled: false, disabledReason: reason },
      })
    }
    await tx.gradeItem.delete({ where: { id } })
    return affected.map((constraint) => constraint.name)
  })

  const scope = before ? await resolveGradeScope(before.gradeId) : null
  await recordAuditLog({
    action: "grade.item.delete",
    entityType: "GradeItem",
    entityId: id,
    scopeId: scope?.scopeId ?? null,
    scopeLabel: scope?.scopeLabel ?? null,
    target: before?.name ?? null,
  })

  return { disabledConstraintNames }
}

/**
 * GradeItemの並び順を一括更新
 */
export async function reorderGradeItems(
  items: { id: string; order: number }[]
) {
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
}
