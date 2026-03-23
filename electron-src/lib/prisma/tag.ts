/**
 * Tag（タグ）のPrisma操作関数
 */

import prisma from "./client"

/**
 * 全タグを取得
 */
export async function getAllTags() {
  return prisma.tag.findMany({
    orderBy: { name: "asc" },
  })
}

/**
 * IDでタグを取得
 */
export async function getTagById(id: string) {
  return prisma.tag.findUnique({
    where: { id },
  })
}

/**
 * SubtotalGroup IDリストに関連するTagを取得
 */
export async function getTagsBySubtotalGroupIds(subtotalGroupIds: string[]) {
  return prisma.tag.findMany({
    where: {
      tagSubtotalGroups: {
        some: {
          subtotalGroupId: { in: subtotalGroupIds },
        },
      },
    },
    include: {
      tagSubtotalGroups: true,
    },
  })
}

/**
 * タグを作成
 */
export async function createTag(data: { name: string }) {
  return prisma.tag.create({
    data: { name: data.name },
  })
}

/**
 * タグを更新
 */
export async function updateTag(id: string, data: { name: string }) {
  return prisma.tag.update({
    where: { id },
    data: { name: data.name },
  })
}

/**
 * タグを削除
 */
export async function deleteTag(id: string) {
  return prisma.tag.delete({
    where: { id },
  })
}

/**
 * 名前で検索、なければ作成
 */
export async function findOrCreateTag(name: string) {
  const existing = await prisma.tag.findUnique({
    where: { name },
  })
  if (existing) return existing

  return prisma.tag.create({
    data: { name },
  })
}
