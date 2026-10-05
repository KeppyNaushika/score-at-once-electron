/**
 * GradeItemExclusion（評価項目除外設定）データアクセス層
 *
 * 除外の主語は「その成績の対象者」（GradeStudent）であり、人（Student）ではない。
 * 名簿に載っていない生徒の除外設定は書けない（FK が拒否する）。
 */

import type { GradeItemExclusionInput } from "../../../src/types/grade.types"
import { recordAuditLog } from "./auditLog"
import { studentAuditLabel, studentAuditTarget } from "./auditTargets"
import prisma from "./client"
import { assertGradeCellsInSameGrade } from "./gradeScopeGuard"

/**
 * 成績の全除外設定を取得
 */
export async function getGradeItemExclusions(gradeId: string) {
  const exclusions = await prisma.gradeItemExclusion.findMany({
    where: { gradeStudent: { gradeId } },
  })
  return exclusions
}

/**
 * 除外の付け外しを操作履歴へ残す。
 *
 * 対象生徒設定の表でチェックを続けて切り替えるので、**成績算出ごとに1行へまとめる**
 * （`coalesceKey`）。変更内容はマス（生徒 × 評価項目）ごとに「最初の状態 → 最後の状態」。
 * 見つからない対象者・評価項目は記録しない（ベストエフォート）。
 */
async function recordGradeItemExclusionAudit(
  input: GradeItemExclusionInput
): Promise<void> {
  const [gradeStudent, gradeItem] = await Promise.all([
    prisma.gradeStudent.findUnique({
      where: { id: input.gradeStudentId },
      include: { student: true, grade: true },
    }),
    prisma.gradeItem.findUnique({ where: { id: input.gradeItemId } }),
  ])
  if (!gradeStudent || !gradeItem) return
  await recordAuditLog({
    action: "grade.exclusion.update",
    entityType: "GradeItemExclusion",
    entityId: gradeStudent.gradeId,
    scopeId: gradeStudent.gradeId,
    scopeLabel: gradeStudent.grade.name,
    targets: [studentAuditTarget(gradeStudent.student)],
    changes: [
      {
        field: `${input.gradeStudentId}:${input.gradeItemId}`,
        label: `${studentAuditLabel(gradeStudent.student)} → ${gradeItem.name}`,
        before: input.excluded ? "対象" : "除外",
        after: input.excluded ? "除外" : "対象",
      },
    ],
    coalesceKey: `grade_exclusion:${gradeStudent.gradeId}`,
  })
}

/**
 * 除外設定の切り替え（excluded=trueで作成、falseで削除）。
 * 既にその状態なら何も変わらないので記録しない。
 */
export async function setGradeItemExclusion(input: GradeItemExclusionInput) {
  const cellKey = {
    gradeStudentId_gradeItemId: {
      gradeStudentId: input.gradeStudentId,
      gradeItemId: input.gradeItemId,
    },
  }
  if (input.excluded) {
    await assertGradeCellsInSameGrade([input])
    const existing = await prisma.gradeItemExclusion.findUnique({
      where: cellKey,
    })
    await prisma.gradeItemExclusion.upsert({
      where: cellKey,
      update: {},
      create: {
        gradeStudentId: input.gradeStudentId,
        gradeItemId: input.gradeItemId,
      },
    })
    if (!existing) await recordGradeItemExclusionAudit(input)
  } else {
    const { count } = await prisma.gradeItemExclusion.deleteMany({
      where: {
        gradeStudentId: input.gradeStudentId,
        gradeItemId: input.gradeItemId,
      },
    })
    if (count > 0) await recordGradeItemExclusionAudit(input)
  }
}
