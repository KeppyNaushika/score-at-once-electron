/**
 * Tag（タグ）のPrisma操作関数
 */

import { recordAuditLog } from "./auditLog"
import prisma from "./client"

/**
 * 全タグを取得（order昇順、同orderはname昇順）
 */
export async function getAllTags() {
  return prisma.tag.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
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
    select: { name: true },
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
