/**
 * TagSubtotalGroup（タグ-小計点グループ関連）のPrisma操作関数
 */

import type { Prisma } from "@prisma/client"

import { recordTagLinkAudit } from "./auditTagLinks"
import prisma from "./client"

/** タグ側から引く形（紐づく小計点グループ名を表示するため同梱） */
const tagSubtotalGroupWithSubtotalGroupInclude = {
  subtotalGroup: true,
} satisfies Prisma.TagSubtotalGroupInclude

/** 小計点グループ同梱の TagSubtotalGroup（`getTagSubtotalGroups` の返り値） */
export type TagSubtotalGroupWithSubtotalGroup =
  Prisma.TagSubtotalGroupGetPayload<{
    include: typeof tagSubtotalGroupWithSubtotalGroupInclude
  }>

/** 小計点グループ側から引く形（他のタグ紐付けと揃えてタグを同梱する） */
export const tagSubtotalGroupWithTagInclude = {
  tag: true,
} satisfies Prisma.TagSubtotalGroupInclude

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
 *
 * 付け外しは操作履歴へ残す。編集画面の「保存」1回で1度だけ呼ばれるので、まとめない。
 * 小計グループは作業領域を持たない（試験をまたいで使う）ので scopeId は付けない。
 */
export async function setSubtotalGroupTags(
  subtotalGroupId: string,
  tagIds: string[]
) {
  const { subtotalGroupBefore, afterLinks } = await prisma.$transaction(
    async (tx) => {
      const subtotalGroup = await tx.subtotalGroup.findUniqueOrThrow({
        where: { id: subtotalGroupId },
        include: { tagSubtotalGroups: { include: { tag: true } } },
      })
      await tx.tagSubtotalGroup.deleteMany({ where: { subtotalGroupId } })
      if (tagIds.length === 0) {
        return { subtotalGroupBefore: subtotalGroup, afterLinks: [] }
      }
      await tx.tagSubtotalGroup.createMany({
        data: tagIds.map((tagId) => ({ subtotalGroupId, tagId })),
      })
      const links = await tx.tagSubtotalGroup.findMany({
        where: { subtotalGroupId },
        include: tagSubtotalGroupWithTagInclude,
      })
      return { subtotalGroupBefore: subtotalGroup, afterLinks: links }
    }
  )

  await recordTagLinkAudit({
    action: "subtotal_group.tag.update",
    entityType: "TagSubtotalGroup",
    entityId: subtotalGroupId,
    target: subtotalGroupBefore.name,
    beforeTags: subtotalGroupBefore.tagSubtotalGroups.map((link) => link.tag),
    afterTags: afterLinks.map((link) => link.tag),
  })
  return afterLinks
}
