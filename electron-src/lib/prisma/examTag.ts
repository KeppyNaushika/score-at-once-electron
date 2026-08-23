/**
 * ExamTag（試験-タグ関連）のPrisma操作関数
 */

import prisma from "./client"

/**
 * 試験に紐づくタグを取得
 */

/**
 * 試験-タグ関連を作成
 */
export async function createExamTag(data: { examId: string; tagId: string }) {
  return prisma.examTag.create({
    data,
  })
}

/**
 * 試験のタグを一括設定（既存を全削除して再作成）
 */
export async function setExamTags(examId: string, tagIds: string[]) {
  return prisma.$transaction(async (tx) => {
    await tx.examTag.deleteMany({ where: { examId } })
    if (tagIds.length === 0) return []
    await tx.examTag.createMany({
      data: tagIds.map((tagId) => ({ examId, tagId })),
    })
    return tx.examTag.findMany({
      where: { examId },
      include: { tag: true },
    })
  })
}
