/**
 * TagSubtotalGroup（タグ-小計グループ関連）のPrisma操作関数
 */

import prisma from "./client"

/**
 * タグのSubtotalGroup関連を取得
 */
export async function getTagSubtotalGroups(tagId: string) {
  return prisma.tagSubtotalGroup.findMany({
    where: { tagId },
    include: {
      subtotalGroup: true,
    },
  })
}

/**
 * 関連を作成
 */
export async function createTagSubtotalGroup(data: {
  tagId: string
  subtotalGroupId: string
}) {
  return prisma.tagSubtotalGroup.create({
    data,
  })
}

/**
 * 関連を削除
 */
export async function deleteTagSubtotalGroup(id: string) {
  return prisma.tagSubtotalGroup.delete({
    where: { id },
  })
}
