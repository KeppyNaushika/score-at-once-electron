/**
 * GradeComparison（比較）のPrisma操作関数
 *
 * この成績算出の評価項目に、任意の成績算出（自分自身も可）の評価項目を対応付ける。
 * 上下の判定も相手の値の算出も renderer が行う。ここは行を運ぶだけ。
 */

import type { Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import { resolveGradeScopeByItem } from "./auditScope"
import prisma from "./client"
import { isRecordNotFoundError } from "./prismaErrors"
import { serializePrisma } from "./serializePrisma"

/**
 * 比較の行が同梱するもの。
 *
 * 相手の評価項目は別の成績算出にあってよいので、その成績算出（名前を出す）と
 * 境界（ポップオーバーで相手の評定の並びを示す）まで辿る。
 */
const gradeComparisonInclude = {
  comparedGradeItem: { include: { grade: true, boundaries: true } },
} satisfies Prisma.GradeComparisonInclude

/** その成績算出の評価項目に付いた比較をすべて取る（項目ごとの登録順） */
export async function getGradeComparisons(gradeId: string) {
  const comparisons = await prisma.gradeComparison.findMany({
    where: { gradeItem: { gradeId } },
    include: gradeComparisonInclude,
    orderBy: [{ gradeItemId: "asc" }, { order: "asc" }],
  })
  // 境界の要求得点率が Decimal なので、IPC を越える前に number へ
  return serializePrisma(comparisons)
}

/**
 * 比較を1つ足す。並びはその項目の末尾。
 *
 * 自分自身と比べても常に → にしかならないので断る。同じ組が既に在れば、その行を
 * そのまま返す（`@@unique` の組が同定の鍵。二度押しでも望んだ状態にはなっている）。
 */
export async function createGradeComparison(comparisonInput: {
  gradeItemId: string
  comparedGradeItemId: string
}) {
  if (comparisonInput.gradeItemId === comparisonInput.comparedGradeItemId) {
    throw new Error("評価項目を自分自身と比較することはできません")
  }

  const existing = await prisma.gradeComparison.findUnique({
    where: {
      gradeItemId_comparedGradeItemId: {
        gradeItemId: comparisonInput.gradeItemId,
        comparedGradeItemId: comparisonInput.comparedGradeItemId,
      },
    },
    include: { ...gradeComparisonInclude, gradeItem: true },
  })
  if (existing) return serializePrisma(existing)

  const maxOrder = await prisma.gradeComparison.aggregate({
    where: { gradeItemId: comparisonInput.gradeItemId },
    _max: { order: true },
  })
  const comparison = await prisma.gradeComparison.create({
    data: {
      gradeItemId: comparisonInput.gradeItemId,
      comparedGradeItemId: comparisonInput.comparedGradeItemId,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    include: { ...gradeComparisonInclude, gradeItem: true },
  })

  const scope = await resolveGradeScopeByItem(comparisonInput.gradeItemId)
  await recordAuditLog({
    action: "grade.comparison.create",
    entityType: "GradeComparison",
    entityId: comparison.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: comparison.gradeItem.name,
  })

  return serializePrisma(comparison)
}

/**
 * 比較を1つ消す。
 *
 * **既に消えていれば何もしない。** 他の端末が先に消していても・二度押しでも、
 * 望んだ状態にはなっている。
 */
export async function deleteGradeComparison(id: string) {
  const comparison = await prisma.gradeComparison
    .delete({ where: { id }, include: { gradeItem: true } })
    .catch((error: unknown) => {
      if (isRecordNotFoundError(error)) return null
      throw error
    })
  if (!comparison) return

  const scope = await resolveGradeScopeByItem(comparison.gradeItemId)
  await recordAuditLog({
    action: "grade.comparison.delete",
    entityType: "GradeComparison",
    entityId: id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    target: comparison.gradeItem.name,
  })
}

/**
 * 比較の並び順を入れ替える。
 *
 * 並べ替えは N 行が全部か無しかなので、ここだけトランザクションで包む
 * （`docs/coding-style.md` の「日常の書き込みに `$transaction` を使わない」の例外）。
 */
export async function reorderGradeComparisons(
  comparisonOrders: { id: string; order: number }[]
) {
  if (comparisonOrders.length === 0) return

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const comparisonOrder of comparisonOrders) {
      await tx.gradeComparison.update({
        where: { id: comparisonOrder.id },
        data: { order: comparisonOrder.order },
      })
    }
  })
}
