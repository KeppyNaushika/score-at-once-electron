/**
 * 出力で使う比較の選択（GradeExportComparison）の読み書き。
 *
 * 成績算出 × 比較 の行で、Excel「成績一覧」の列と、個人成績通知書の「評価」に添える
 * 記号の両方がこの選択に従う。**行が無い比較は出す**（`DEFAULT_EXPORT_COMPARISON_ENABLED`）
 * ので、書くのは利用者が切り替えたときだけ。
 *
 * 成績算出が読む表ではないので、成績算出のロック（`gradeWriteLock.ts`）では止まらない。
 */

import { formatComparedTargetName } from "../../../src/lib/shared/gradeComparisonNames"
import { DEFAULT_EXPORT_COMPARISON_ENABLED } from "../../../src/types/gradeExport.types"
import { recordAuditLog } from "./auditLog"
import { resolveGradeScope } from "./auditScope"
import prisma from "./client"

/** その成績算出の選択の行をすべて取る（行が無い比較は既定で出す） */
export async function getGradeExportComparisons(gradeId: string) {
  return prisma.gradeExportComparison.findMany({ where: { gradeId } })
}

/**
 * 比較を出力に載せるかを書く。鍵は `@@unique`（id は uuidv4 で端末ごとに異なる）。
 *
 * 比較がこの成績算出のものでなければ断る（別の成績算出の選択として残ると、どこからも
 * 見えない行になる）。比較が既に消えていても断る。
 */
export async function setGradeExportComparison(selectionInput: {
  gradeId: string
  gradeComparisonId: string
  enabled: boolean
}) {
  const comparison = await prisma.gradeComparison.findUnique({
    where: { id: selectionInput.gradeComparisonId },
    include: {
      gradeItem: true,
      comparedGradeItem: { include: { grade: true } },
    },
  })
  if (!comparison) {
    throw new Error(
      "比較が見つかりません（他の端末で削除された可能性があります）"
    )
  }
  if (comparison.gradeItem.gradeId !== selectionInput.gradeId) {
    throw new Error("この成績算出の比較ではありません")
  }

  const selectionKey = {
    gradeId_gradeComparisonId: {
      gradeId: selectionInput.gradeId,
      gradeComparisonId: selectionInput.gradeComparisonId,
    },
  }
  const selectionBefore = await prisma.gradeExportComparison.findUnique({
    where: selectionKey,
  })
  const selectionAfter = await prisma.gradeExportComparison.upsert({
    where: selectionKey,
    update: { enabled: selectionInput.enabled },
    create: {
      gradeId: selectionInput.gradeId,
      gradeComparisonId: selectionInput.gradeComparisonId,
      enabled: selectionInput.enabled,
    },
  })

  const enabledBefore =
    selectionBefore?.enabled ?? DEFAULT_EXPORT_COMPARISON_ENABLED
  if (enabledBefore !== selectionAfter.enabled) {
    const comparedGradeItem = comparison.comparedGradeItem
    const scope = await resolveGradeScope(selectionInput.gradeId)
    // 出力画面で続けて切り替えるので、成績算出ごとに1行へまとめる
    await recordAuditLog({
      action: "grade.export_comparison.update",
      entityType: "GradeExportComparison",
      entityId: selectionAfter.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      changes: [
        {
          field: comparison.id,
          label: `${comparison.gradeItem.name} と ${formatComparedTargetName(
            comparedGradeItem.gradeId === selectionInput.gradeId
              ? null
              : comparedGradeItem.grade.name,
            comparedGradeItem.name
          )}`,
          before: enabledBefore ? "出す" : "出さない",
          after: selectionAfter.enabled ? "出す" : "出さない",
        },
      ],
      coalesceKey: `grade_export_comparisons:${selectionInput.gradeId}`,
    })
  }

  return selectionAfter
}
