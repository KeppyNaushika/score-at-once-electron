/**
 * 成績のセルの対象者と評価項目が同じ成績に属することの検査
 *
 * 成績のセル（GradeOverride / GradeFrozenScore / GradeItemExclusion）は
 * 「対象者（GradeStudent）」と「評価項目（GradeItem）」の2つを参照する。FK が保証するのは
 * **それぞれが実在すること**だけで、両者が同じ Grade に属することは強制されない。
 * 食い違ったまま書けると、成績 A の対象者に成績 B の評価項目の上書き・確定値がぶら下がり、
 * どちらの画面にも出ないのに DB には残る — #962 で塞いだのと同じ穴が別の入口から開く。
 *
 * どちらの id も string なので取り違えてもコンパイルは通る。書き込みの入口で
 * 実際に成績を突き合わせて弾く（examScopeGuard / assertSameCoursework と同じ考え方）。
 */

import prisma from "./client"
import type { Tx } from "./transactionClient"

type PrismaLike = typeof prisma | Tx

/** 検査に失敗したときのエラー。呼び出し側は success:false へ倒す */
class GradeScopeMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GradeScopeMismatchError"
  }
}

/**
 * 成績のセルの対象者と評価項目が同じ成績のものか検査する。
 * 解決できない id があればその時点でエラーにする（存在しない親を指す行を作らせない）。
 */
export async function assertGradeCellsInSameGrade(
  cells: { gradeStudentId: string; gradeItemId: string }[],
  client: PrismaLike = prisma
): Promise<void> {
  if (cells.length === 0) return

  const [gradeStudents, gradeItems] = await Promise.all([
    client.gradeStudent.findMany({
      where: {
        id: { in: [...new Set(cells.map((cell) => cell.gradeStudentId))] },
      },
      select: { id: true, gradeId: true },
    }),
    client.gradeItem.findMany({
      where: {
        id: { in: [...new Set(cells.map((cell) => cell.gradeItemId))] },
      },
      select: { id: true, gradeId: true },
    }),
  ])

  const gradeIdByGradeStudent = new Map(
    gradeStudents.map((gradeStudent) => [gradeStudent.id, gradeStudent.gradeId])
  )
  const gradeIdByGradeItem = new Map(
    gradeItems.map((gradeItem) => [gradeItem.id, gradeItem.gradeId])
  )

  for (const cell of cells) {
    const studentGradeId = gradeIdByGradeStudent.get(cell.gradeStudentId)
    const itemGradeId = gradeIdByGradeItem.get(cell.gradeItemId)
    if (!studentGradeId || !itemGradeId) {
      throw new GradeScopeMismatchError(
        "対象生徒または評価項目が見つかりません"
      )
    }
    if (studentGradeId !== itemGradeId) {
      throw new GradeScopeMismatchError(
        "対象生徒と評価項目が別の成績に属しています"
      )
    }
  }
}
