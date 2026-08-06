/**
 * Tag（タグ）のPrisma操作関数
 */

import type { Prisma } from "@prisma/client"

import { recordAuditLog } from "./auditLog"
import prisma from "./client"

/**
 * Tag が持つ全リレーション（＝タグが何に付いているか）。タグ本体は用途を持たず、
 * それを決めるのは結合テーブルなので、各結合行をそのまま返す。
 * 現在の読み手はタグ管理画面の利用先表示で、件数への集約は renderer 側で行う
 * （規約: 計算は renderer 側）。Tag にリレーションを足したらここにも足す。
 */
const tagWithAllRelationsInclude = {
  examTags: true,
  courseworkTags: true,
  asbDefinitionTags: true,
  tagSubtotalGroups: true,
} satisfies Prisma.TagInclude

/** 全リレーションの結合行を含む Tag（`getAllTags` の返り値） */
export type TagWithAllRelations = Prisma.TagGetPayload<{
  include: typeof tagWithAllRelationsInclude
}>

/**
 * 全タグを取得（order昇順、同orderはname昇順）
 */
export async function getAllTags() {
  return prisma.tag.findMany({
    include: tagWithAllRelationsInclude,
    orderBy: [{ order: "asc" }, { name: "asc" }],
  })
}

/**
 * タグを作成（orderは自動採番）
 */
export async function createTag(data: { name: string; color?: string }) {
  const maxOrder = await prisma.tag.aggregate({ _max: { order: true } })
  const nextOrder = (maxOrder._max.order ?? -1) + 1
  const tag = await prisma.tag.create({
    data: {
      name: data.name,
      color: data.color ?? null,
      order: nextOrder,
    },
  })

  await recordAuditLog({
    action: "tag.create",
    entityType: "Tag",
    entityId: tag.id,
    target: tag.name,
  })

  return tag
}

/**
 * タグを更新
 */
export async function updateTag(
  id: string,
  data: { name?: string; color?: string | null }
) {
  const tag = await prisma.tag.update({
    where: { id },
    data,
  })

  await recordAuditLog({
    action: "tag.update",
    entityType: "Tag",
    entityId: tag.id,
    target: tag.name,
  })

  return tag
}

/**
 * タグを削除
 */
export async function deleteTag(id: string) {
  const before = await prisma.tag.findUnique({
    where: { id },
  })

  const tag = await prisma.tag.delete({
    where: { id },
  })

  await recordAuditLog({
    action: "tag.delete",
    entityType: "Tag",
    entityId: id,
    target: before?.name ?? null,
  })

  return tag
}

/**
 * 名前で検索、なければ作成
 */
export async function findOrCreateTag(name: string) {
  const existing = await prisma.tag.findUnique({
    where: { name },
  })
  if (existing) return existing

  const maxOrder = await prisma.tag.aggregate({ _max: { order: true } })
  const nextOrder = (maxOrder._max.order ?? -1) + 1
  return prisma.tag.create({
    data: { name, order: nextOrder },
  })
}

/**
 * タグの並び順を一括更新
 */
export async function reorderTags(tagIds: string[]) {
  const result = await prisma.$transaction(
    tagIds.map((id, index) =>
      prisma.tag.update({
        where: { id },
        data: { order: index },
      })
    )
  )

  await recordAuditLog({
    action: "tag.reorder",
    entityType: "Tag",
    entityId: "tag-order",
    coalesceKey: "tag_reorder",
  })

  return result
}
