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

/**
 * 一括更新（トランザクション）
 */
export async function batchUpdateGradeItemExclusions(
  updates: GradeItemExclusionInput[]
) {
  try {
    const added = updates.filter((update) => update.excluded)
    await assertGradeCellsInSameGrade(added)

    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        if (update.excluded) {
          await tx.gradeItemExclusion.upsert({
            where: {
              gradeStudentId_gradeItemId: {
                gradeStudentId: update.gradeStudentId,
                gradeItemId: update.gradeItemId,
              },
            },
            update: {},
            create: {
              gradeStudentId: update.gradeStudentId,
              gradeItemId: update.gradeItemId,
            },
          })
        } else {
          await tx.gradeItemExclusion.deleteMany({
            where: {
              gradeStudentId: update.gradeStudentId,
              gradeItemId: update.gradeItemId,
            },
          })
        }
      }
    })
    return { success: true }
  } catch (error) {
    console.error("Error batch updating grade item exclusions:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
