/**
 * SubjectSubtotalGroup（教科-小計グループ関連）のPrisma操作関数
 */

import prisma from "./client"

/**
 * 教科のSubtotalGroup関連を取得
 */
export async function getSubjectSubtotalGroups(subjectId: string) {
  return prisma.subjectSubtotalGroup.findMany({
    where: { subjectId },
    include: {
      subtotalGroup: true,
    },
  })
}

/**
 * SubtotalGroup IDリストから関連を取得
 */
export async function getSubjectSubtotalGroupsBySubtotalGroupIds(
  subtotalGroupIds: string[]
) {
  return prisma.subjectSubtotalGroup.findMany({
    where: { subtotalGroupId: { in: subtotalGroupIds } },
  })
}

/**
 * 関連を作成
 */
export async function createSubjectSubtotalGroup(data: {
  subjectId: string
  subtotalGroupId: string
}) {
  return prisma.subjectSubtotalGroup.create({
    data,
  })
}

/**
 * 関連を削除
 */
export async function deleteSubjectSubtotalGroup(id: string) {
  return prisma.subjectSubtotalGroup.delete({
    where: { id },
  })
}

/**
 * 教科の全関連を削除
 */
export async function deleteSubjectSubtotalGroupsBySubjectId(
  subjectId: string
) {
  return prisma.subjectSubtotalGroup.deleteMany({
    where: { subjectId },
  })
}
