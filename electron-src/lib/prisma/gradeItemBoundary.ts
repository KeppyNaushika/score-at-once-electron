/**
 * GradeItemBoundary（成績境界）のPrisma操作関数
 *
 * 境界の有無は行の有無そのもの。かつては属性を持たない容器 GradeBoundarySet を挟んでおり、
 * 境界を全行消してもセット行が生き残って「境界は無いのに設定済み」になっていた。
 *
 * 取得の関数は無い。境界は評価項目の子として `gradeItemWithDataSourcesInclude` に同梱され、
 * `getGradeById` / `getAllGrades` が行のまま返す。
 *
 * **書き込みは1行ずつ。** かつては `replaceGradeItemBoundaries` が全行を削除して
 * 作り直していたが、それは「これが今の全体像です」という状態を運ぶ経路で、利用者が
 * 触っていない行まで巻き添えにする。並べ替えだけは N 行が全部か無しかなので
 * トランザクションで包む。
 */

import type { Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import { resolveGradeScopeByItem } from "./auditScope"
import prisma from "./client"

/**
 * 評価項目の境界を丸ごと置き換える。**一括経路**（`docs/coding-style.md` の
 * 「状態を運んでよい経路」）。
 *
 * 使ってよいのはプリセットの適用だけ。「この刻みにしろ」という一括操作なので、
 * 触っていない行という概念が無い。日常の編集（1本のラベルを直す・1本足す）を
 * ここへ流してはいけない — 全行の id が変わり、他端末の編集を巻き添えにする。
 */
export async function replaceGradeItemBoundaries(data: {
  gradeItemId: string
  boundaries: { label: string; minPercentage: number; order: number }[]
}) {
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
    action: "grade.boundary.replace",
    entityType: "GradeItemBoundary",
    entityId: data.gradeItemId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
  })
}

/** 境界を1本追加する */
export async function createGradeItemBoundary(data: {
  gradeItemId: string
  label: string
  minPercentage: number
  order: number
}) {
  const boundary = await prisma.gradeItemBoundary.create({ data })

  const scope = await resolveGradeScopeByItem(data.gradeItemId)
  await recordAuditLog({
    action: "grade.boundary.create",
    entityType: "GradeItemBoundary",
    entityId: boundary.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
  })

  return boundary
}

/** 境界1本のラベルまたは下限を変える */
export async function updateGradeItemBoundary(
  id: string,
  data: { label?: string; minPercentage?: number }
) {
  const boundary = await prisma.gradeItemBoundary.update({
    where: { id },
    data,
  })

  const scope = await resolveGradeScopeByItem(boundary.gradeItemId)
  await recordAuditLog({
    action: "grade.boundary.update",
    entityType: "GradeItemBoundary",
    entityId: boundary.id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
  })

  return boundary
}

/** 境界を1本消す */
export async function deleteGradeItemBoundary(id: string) {
  const boundary = await prisma.gradeItemBoundary.delete({ where: { id } })

  const scope = await resolveGradeScopeByItem(boundary.gradeItemId)
  await recordAuditLog({
    action: "grade.boundary.delete",
    entityType: "GradeItemBoundary",
    entityId: id,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
  })
}

/**
 * 境界の並び順を入れ替える。
 *
 * 並べ替えは N 行が全部か無しかなので、ここだけトランザクションで包む
 * （`docs/coding-style.md` の「日常の書き込みに `$transaction` を使わない」の例外）。
 */
export async function reorderGradeItemBoundaries(
  items: { id: string; order: number }[]
) {
  if (items.length === 0) return

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const item of items) {
      await tx.gradeItemBoundary.update({
        where: { id: item.id },
        data: { order: item.order },
      })
    }
  })
}

/**
 * 評価項目の境界をすべて削除する。
 *
 * 1本ずつ消すのと結果は同じだが、教員が確認ダイアログを経て明示的に「全部消す」と
 * 決めた操作なので、監査ログへ別アクションで残す（1本ずつの削除と混ざらないようにする）。
 */
export async function deleteGradeItemBoundaries(gradeItemId: string) {
  await prisma.gradeItemBoundary.deleteMany({ where: { gradeItemId } })

  const scope = await resolveGradeScopeByItem(gradeItemId)
  await recordAuditLog({
    action: "grade.boundary.deleteAll",
    entityType: "GradeItemBoundary",
    entityId: gradeItemId,
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
  })
}
