/**
 * GradeItemExclusion（評価項目除外設定）データアクセス層
 */

import prisma from "./client"

/**
 * プロジェクトの全除外設定を取得
 */
export async function getGradeItemExclusions(gradeProjectId: string) {
  try {
    const exclusions = await prisma.gradeItemExclusion.findMany({
      where: { gradeProjectId },
    })
    return {
      success: true,
      exclusions: exclusions.map((ex) => ({
        id: ex.id,
        gradeProjectId: ex.gradeProjectId,
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
  gradeProjectId: string
  studentId: string
  gradeItemId: string
  excluded: boolean
}) {
  try {
    if (data.excluded) {
      await prisma.gradeItemExclusion.upsert({
        where: {
          gradeProjectId_studentId_gradeItemId: {
            gradeProjectId: data.gradeProjectId,
            studentId: data.studentId,
            gradeItemId: data.gradeItemId,
          },
        },
        update: {},
        create: {
          gradeProjectId: data.gradeProjectId,
          studentId: data.studentId,
          gradeItemId: data.gradeItemId,
        },
      })
    } else {
      await prisma.gradeItemExclusion.deleteMany({
        where: {
          gradeProjectId: data.gradeProjectId,
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
  gradeProjectId: string,
  updates: { studentId: string; gradeItemId: string; excluded: boolean }[]
) {
  try {
    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        if (update.excluded) {
          await tx.gradeItemExclusion.upsert({
            where: {
              gradeProjectId_studentId_gradeItemId: {
                gradeProjectId,
                studentId: update.studentId,
                gradeItemId: update.gradeItemId,
              },
            },
            update: {},
            create: {
              gradeProjectId,
              studentId: update.studentId,
              gradeItemId: update.gradeItemId,
            },
          })
        } else {
          await tx.gradeItemExclusion.deleteMany({
            where: {
              gradeProjectId,
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
