/**
 * GradeItemExclusion（評価項目除外設定）データアクセス層
 */

import prisma from "./client"

/**
 * 試験の全除外設定を取得
 */
export async function getGradeItemExclusions(gradeId: string) {
  try {
    const exclusions = await prisma.gradeItemExclusion.findMany({
      where: { gradeId },
    })
    return {
      success: true,
      exclusions: exclusions.map((ex) => ({
        id: ex.id,
        gradeId: ex.gradeId,
        studentId: ex.studentId,
        gradeItemId: ex.gradeItemId,
      })),
    }
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
export async function setGradeItemExclusion(data: {
  gradeId: string
  studentId: string
  gradeItemId: string
  excluded: boolean
}) {
  try {
    if (data.excluded) {
      await prisma.gradeItemExclusion.upsert({
        where: {
          gradeId_studentId_gradeItemId: {
            gradeId: data.gradeId,
            studentId: data.studentId,
            gradeItemId: data.gradeItemId,
          },
        },
        update: {},
        create: {
          gradeId: data.gradeId,
          studentId: data.studentId,
          gradeItemId: data.gradeItemId,
        },
      })
    } else {
      await prisma.gradeItemExclusion.deleteMany({
        where: {
          gradeId: data.gradeId,
          studentId: data.studentId,
          gradeItemId: data.gradeItemId,
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
  gradeId: string,
  updates: { studentId: string; gradeItemId: string; excluded: boolean }[]
) {
  try {
    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        if (update.excluded) {
          await tx.gradeItemExclusion.upsert({
            where: {
              gradeId_studentId_gradeItemId: {
                gradeId,
                studentId: update.studentId,
                gradeItemId: update.gradeItemId,
              },
            },
            update: {},
            create: {
              gradeId,
              studentId: update.studentId,
              gradeItemId: update.gradeItemId,
            },
          })
        } else {
          await tx.gradeItemExclusion.deleteMany({
            where: {
              gradeId,
              studentId: update.studentId,
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
