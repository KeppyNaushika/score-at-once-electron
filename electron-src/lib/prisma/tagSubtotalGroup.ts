/**
 * TagSubtotalGroup（タグ-小計点グループ関連）のPrisma操作関数
 */

import type { Prisma } from "@prisma/client"

import prisma from "./client"

/** タグ側から引く形（紐づく小計点グループ名を表示するため同梱） */
const tagSubtotalGroupWithSubtotalGroupInclude = {
  subtotalGroup: {
    select: { id: true, name: true },
  },
} satisfies Prisma.TagSubtotalGroupInclude

/** 小計点グループ同梱の TagSubtotalGroup（`getTagSubtotalGroups` の返り値） */
export type TagSubtotalGroupWithSubtotalGroup =
  Prisma.TagSubtotalGroupGetPayload<{
    include: typeof tagSubtotalGroupWithSubtotalGroupInclude
  }>

/** 小計点グループ側から引く形（他のタグ紐付けと揃えてタグを同梱する） */
export const tagSubtotalGroupWithTagInclude = {
  tag: {
    select: { id: true, name: true, color: true },
  },
} satisfies Prisma.TagSubtotalGroupInclude

/** タグ同梱の TagSubtotalGroup（`setSubtotalGroupTags` の返り値） */
export type TagSubtotalGroupWithTag = Prisma.TagSubtotalGroupGetPayload<{
  include: typeof tagSubtotalGroupWithTagInclude
}>

/**
 * タグに紐づく小計点グループを取得
 */
export async function getTagSubtotalGroups(tagId: string) {
  return prisma.tagSubtotalGroup.findMany({
    where: { tagId },
    include: tagSubtotalGroupWithSubtotalGroupInclude,
    orderBy: { subtotalGroup: { name: "asc" } },
  })
}

/**
 * 小計点グループのタグを一括設定（既存を全削除して再作成）
 */
export async function setSubtotalGroupTags(
  subtotalGroupId: string,
  tagIds: string[]
) {
  return prisma.$transaction(async (tx) => {
    await tx.tagSubtotalGroup.deleteMany({ where: { subtotalGroupId } })
    if (tagIds.length === 0) return []
    await tx.tagSubtotalGroup.createMany({
      data: tagIds.map((tagId) => ({ subtotalGroupId, tagId })),
    })
    return tx.tagSubtotalGroup.findMany({
      where: { subtotalGroupId },
      include: tagSubtotalGroupWithTagInclude,
    })
  })
}
