/**
 * GradeConstraint（観点間の制約ルール）のPrisma操作関数
 *
 * 設定は kind 別のJSONではなくリレーションで持つ（issue #1063）。比較先・集計対象は
 * 評価項目への FK なので、項目をリネームしても参照は切れない。
 */

import type { Prisma } from "@prisma/client"

import type { GradeConstraintInput } from "../../../src/types/grade.types"
import { recordAuditLog } from "./auditLog"
import { resolveGradeScope } from "./auditScope"
import prisma from "./client"
import { serializePrisma } from "./serializePrisma"

/**
 * 制約ルールが持つ設定リレーションの include（単一 SSOT）。
 * 全生成元でこれを使い、返り値の形状を一致させる。
 */
export const gradeConstraintInclude = {
  viewpoints: { orderBy: { order: "asc" } },
  labelValues: { orderBy: { order: "asc" } },
  exclusionLabels: { orderBy: { order: "asc" } },
} satisfies Prisma.GradeConstraintInclude

/** 集計対象の観点（GradeItem）の nested create 行。重複は畳む（`@@unique` 違反回避）。 */
function buildConstraintViewpointRows(gradeItemIds: string[]) {
  const unique = [...new Set(gradeItemIds)]
  return unique.map((gradeItemId, index) => ({
    gradeItemId,
    order: index,
  }))
}

/** ラベル→数値の対応の nested create 行。 */
function buildConstraintLabelValueRows(labelValues: Record<string, number>) {
  return Object.entries(labelValues).map(([label, value], index) => ({
    label,
    value,
    order: index,
  }))
}

/** 混在禁止ラベルの nested create 行。重複は畳む。 */
function buildConstraintExclusionLabelRows(labels: string[]) {
  const unique = [...new Set(labels)]
  return unique.map((label, index) => ({
    label,
    order: index,
  }))
}

/**
 * 制約ルールの設定リレーションを書く（作成・更新・複製・アーカイブ取込の共通経路）。
 * 未指定（undefined）の項目は触らない。指定されたものは総入れ替えする。
 *
 * 据え置く行は update で通し、実際に外れた行だけ削除する。全消し→再作成にすると、
 * 変えていない行まで sqlite-nas-sync の changelog と tombstone を動かすため。
 * upsert の鍵は id ではなく `@@unique`（idは uuidv4 で端末ごとに異なる）。
 *
 * 子行は親への FK を持つので、親を作った後に呼ぶ。呼び出し側は必ず同一トランザクション
 * で包むこと（本体だけ出来て設定が入らないと、viewpointsゼロ＝「比較先以外の全項目」
 * という設定していないルールとして動き出す）。
 */
export async function writeConstraintConfig(
  tx: Prisma.TransactionClient,
  constraintId: string,
  constraint: Partial<GradeConstraintInput>
) {
  if (constraint.viewpointGradeItemIds !== undefined) {
    const rows = buildConstraintViewpointRows(constraint.viewpointGradeItemIds)
    await tx.gradeConstraintViewpoint.deleteMany({
      where: {
        constraintId,
        ...(rows.length > 0 && {
          gradeItemId: { notIn: rows.map((row) => row.gradeItemId) },
        }),
      },
    })
    for (const row of rows) {
      // 鍵は id ではなく `@@unique`。idは uuidv4 で、同じ組み合わせでも端末ごとに異なる
      await tx.gradeConstraintViewpoint.upsert({
        where: {
          constraintId_gradeItemId: {
            constraintId,
            gradeItemId: row.gradeItemId,
          },
        },
        create: { ...row, constraintId },
        update: { order: row.order },
      })
    }
  }

  if (constraint.labelValues !== undefined) {
    const rows = buildConstraintLabelValueRows(constraint.labelValues)
    await tx.gradeConstraintLabelValue.deleteMany({
      where: {
        constraintId,
        ...(rows.length > 0 && {
          label: { notIn: rows.map((row) => row.label) },
        }),
      },
    })
    for (const row of rows) {
      await tx.gradeConstraintLabelValue.upsert({
        where: { constraintId_label: { constraintId, label: row.label } },
        create: { ...row, constraintId },
        update: { value: row.value, order: row.order },
      })
    }
  }

  if (constraint.exclusionLabels !== undefined) {
    const rows = buildConstraintExclusionLabelRows(constraint.exclusionLabels)
    await tx.gradeConstraintExclusionLabel.deleteMany({
      where: {
        constraintId,
        ...(rows.length > 0 && {
          label: { notIn: rows.map((row) => row.label) },
        }),
      },
    })
    for (const row of rows) {
      await tx.gradeConstraintExclusionLabel.upsert({
        where: { constraintId_label: { constraintId, label: row.label } },
        create: { ...row, constraintId },
        update: { order: row.order },
      })
    }
  }
}

/**
 * 成績の全制約ルールを取得（order昇順）
 */
export async function getGradeConstraints(gradeId: string) {
  try {
    const constraints = await prisma.gradeConstraint.findMany({
      where: { gradeId },
      include: gradeConstraintInclude,
      orderBy: { order: "asc" },
    })
    // tolerance / labelValues.value は Decimal 列。IPC を跨ぐ前に number へ倒さないと
    // renderer 側の数値比較が黙って壊れる（型は number を主張するので気づけない）。
    return { success: true, constraints: serializePrisma(constraints) }
  } catch (error) {
    console.error("Error getting grade constraints:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 制約ルールを新規作成
 */
export async function createGradeConstraint(data: {
  gradeId: string
  constraint: GradeConstraintInput
}) {
  try {
    // 本体と設定は同一トランザクションで書く。設定の書き込みが失敗したときに
    // 本体だけ残ると、viewpointsゼロ＝「比較先以外の全項目」という設定していない
    // ルールが結果表を着色しはじめる。
    const created = await prisma.$transaction(async (tx) => {
      const constraint = await tx.gradeConstraint.create({
        data: {
          gradeId: data.gradeId,
          name: data.constraint.name,
          kind: data.constraint.kind,
          targetGradeItemId: data.constraint.targetGradeItemId,
          aggregate: data.constraint.aggregate,
          tolerance: data.constraint.tolerance,
          expression: data.constraint.expression,
          color: data.constraint.color,
          message: data.constraint.message,
          enabled: data.constraint.enabled,
          order: data.constraint.order,
        },
      })
      // 設定リレーションは本体への FK を持つため、本体作成後に書く
      await writeConstraintConfig(tx, constraint.id, data.constraint)
      return tx.gradeConstraint.findUniqueOrThrow({
        where: { id: constraint.id },
        include: gradeConstraintInclude,
      })
    })

    const scope = await resolveGradeScope(data.gradeId)
    await recordAuditLog({
      action: "grade.constraint.create",
      entityType: "GradeConstraint",
      entityId: created.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
    })

    return { success: true, constraint: serializePrisma(created) }
  } catch (error) {
    console.error("Error creating grade constraint:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 制約ルールを更新
 */
export async function updateGradeConstraint(data: {
  id: string
  constraint: Partial<GradeConstraintInput>
}) {
  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.gradeConstraint.update({
        where: { id: data.id },
        data: {
          name: data.constraint.name,
          kind: data.constraint.kind,
          targetGradeItemId: data.constraint.targetGradeItemId,
          aggregate: data.constraint.aggregate,
          tolerance: data.constraint.tolerance,
          expression: data.constraint.expression,
          color: data.constraint.color,
          message: data.constraint.message,
          enabled: data.constraint.enabled,
          order: data.constraint.order,
          // 自動で無効化した理由は、利用者が有効へ戻した時点で役目を終える
          ...(data.constraint.enabled === true && { disabledReason: null }),
        },
      })
      await writeConstraintConfig(tx, data.id, data.constraint)
      return tx.gradeConstraint.findUniqueOrThrow({
        where: { id: data.id },
        include: gradeConstraintInclude,
      })
    })

    const scope = await resolveGradeScope(updated.gradeId)
    await recordAuditLog({
      action: "grade.constraint.update",
      entityType: "GradeConstraint",
      entityId: updated.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
    })

    return { success: true, constraint: serializePrisma(updated) }
  } catch (error) {
    console.error("Error updating grade constraint:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 制約ルールを削除
 */
export async function deleteGradeConstraint(id: string) {
  try {
    const existing = await prisma.gradeConstraint.findUnique({ where: { id } })
    if (existing) {
      await prisma.gradeConstraint.delete({ where: { id } })

      const scope = await resolveGradeScope(existing.gradeId)
      await recordAuditLog({
        action: "grade.constraint.delete",
        entityType: "GradeConstraint",
        entityId: id,
        scopeId: scope.scopeId,
        scopeLabel: scope.scopeLabel,
      })
    }
    return { success: true }
  } catch (error) {
    console.error("Error deleting grade constraint:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
