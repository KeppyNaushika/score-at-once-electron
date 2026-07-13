/**
 * AsbDefinitionTag（解答用紙定義-タグ関連）のPrisma操作関数
 */

import prisma from "./client"

/**
 * 解答用紙定義に紐づくタグを取得
 */
export async function getAsbDefinitionTags(asbDefinitionId: string) {
  return prisma.asbDefinitionTag.findMany({
    where: { asbDefinitionId },
    include: {
      tag: true,
    },
  })
}

/**
 * 解答用紙定義-タグ関連を作成
 */
export async function createAsbDefinitionTag(data: {
  asbDefinitionId: string
  tagId: string
}) {
  return prisma.asbDefinitionTag.create({
    data,
  })
}

/**
 * 解答用紙定義-タグ関連を削除
 */
export async function deleteAsbDefinitionTag(id: string) {
  return prisma.asbDefinitionTag.delete({
    where: { id },
  })
}

/**
 * 解答用紙定義のタグを一括設定（既存を全削除して再作成）
 */
export async function setAsbDefinitionTags(
  asbDefinitionId: string,
  tagIds: string[]
) {
  return prisma.$transaction(async (tx) => {
    await tx.asbDefinitionTag.deleteMany({ where: { asbDefinitionId } })
    if (tagIds.length === 0) return []
    await tx.asbDefinitionTag.createMany({
      data: tagIds.map((tagId) => ({ asbDefinitionId, tagId })),
    })
    return tx.asbDefinitionTag.findMany({
      where: { asbDefinitionId },
      include: { tag: true },
    })
  })
}
