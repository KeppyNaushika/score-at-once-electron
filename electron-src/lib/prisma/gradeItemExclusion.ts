/**
 * GradeItemExclusion（評価項目除外設定）データアクセス層
 *
 * 除外の主語は「その成績の対象者」（GradeStudent）であり、人（Student）ではない。
 * 名簿に載っていない生徒の除外設定は書けない（FK が拒否する）。
 */

import type { GradeItemExclusionInput } from "../../../src/types/grade.types"
import prisma from "./client"
import { assertGradeCellsInSameGrade } from "./gradeScopeGuard"

/**
 * 成績の全除外設定を取得
 */
export async function getGradeItemExclusions(gradeId: string) {
  try {
    const exclusions = await prisma.gradeItemExclusion.findMany({
      where: { gradeStudent: { gradeId } },
    })
    return { success: true, exclusions }
  } catch (error) {
    console.error("Error getting grade item exclusions:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * 除外設定の切り替え（excluded=trueで作成、falseで削除）
 */
export async function setGradeItemExclusion(input: GradeItemExclusionInput) {
  try {
    if (input.excluded) {
      await assertGradeCellsInSameGrade([input])
      await prisma.gradeItemExclusion.upsert({
        where: {
          gradeStudentId_gradeItemId: {
            gradeStudentId: input.gradeStudentId,
            gradeItemId: input.gradeItemId,
          },
        },
        update: {},
        create: {
          gradeStudentId: input.gradeStudentId,
          gradeItemId: input.gradeItemId,
        },
      })
    } else {
      await prisma.gradeItemExclusion.deleteMany({
        where: {
          gradeStudentId: input.gradeStudentId,
          gradeItemId: input.gradeItemId,
        },
      })
    }
    return { success: true }
  } catch (error) {
    console.error("Error setting grade item exclusion:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
