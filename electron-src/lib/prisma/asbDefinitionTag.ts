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
 * 解答用紙のタグを設定する。
 *
 * **外れたものだけ消し、付いたものだけ作る。** 全削除して作り直すと、変えていない
 * タグの紐付けまで別の行として作り直されるので、同期先では「全部消して全部足した」
 * ことになる。2端末が別々のタグを付けただけで後から保存した側が丸ごと勝つ。
 */
export async function setAsbDefinitionTags(
  asbDefinitionId: string,
  tagIds: string[]
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.asbDefinitionTag.findMany({
      where: { asbDefinitionId },
    })
    const currentTagIds = new Set(current.map((link) => link.tagId))
    const nextTagIds = new Set(tagIds)

    const removed = current.filter((link) => !nextTagIds.has(link.tagId))
    if (removed.length > 0) {
      await tx.asbDefinitionTag.deleteMany({
        where: { id: { in: removed.map((link) => link.id) } },
      })
    }
    const added = tagIds.filter((tagId) => !currentTagIds.has(tagId))
    if (added.length > 0) {
      await tx.asbDefinitionTag.createMany({
        data: added.map((tagId) => ({ asbDefinitionId, tagId })),
      })
    }

    return tx.asbDefinitionTag.findMany({
      where: { asbDefinitionId },
      include: { tag: true },
    })
  })
}
