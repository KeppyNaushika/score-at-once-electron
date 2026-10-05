/**
 * AsbDefinitionTag（解答用紙定義-タグ関連）のPrisma操作関数
 */

import type { Prisma, Tag } from "@prisma/client"

import { writeAsbDefinitionContent } from "./asbDefinitionWrite"
import { recordTagLinkAudit } from "./auditTagLinks"
import prisma from "./client"

/** 付け替え前の姿（名前とタグ）。記録に使う */
const asbDefinitionWithTagsInclude = {
  tags: { include: { tag: true } },
} satisfies Prisma.AsbDefinitionInclude

/**
 * 書き込みの中で読んだ、付け替え前の解答用紙（名前とタグ）と付け替え後のタグ。
 *
 * 記録はトランザクションの外で行うので、書き込みの関数から外へ持ち出す入れ物にする。
 */
interface AsbDefinitionTagChange {
  definition: Prisma.AsbDefinitionGetPayload<{
    include: typeof asbDefinitionWithTagsInclude
  }> | null
  afterTags: Tag[]
}

/**
 * 解答用紙のタグの付け外しを操作履歴へ残す。
 *
 * 概要のタグ欄は1つ付けるたびに書き、続けて付けられる（popover を開いたまま）ので、
 * **解答用紙ごとに1行へまとめる**（`coalesceKey`）。変更内容は「最初のタグ → 最後のタグ」。
 */
async function recordAsbDefinitionTagAudit({
  definition,
  afterTags,
}: AsbDefinitionTagChange): Promise<void> {
  if (!definition) return
  await recordTagLinkAudit({
    action: "answer_sheet.tag.update",
    entityType: "AsbDefinitionTag",
    entityId: definition.id,
    scopeId: definition.id,
    scopeLabel: definition.name,
    target: definition.name,
    beforeTags: definition.tags.map((link) => link.tag),
    afterTags,
    coalesceKey: `answer_sheet_tags:${definition.id}`,
  })
}

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
 * 解答用紙定義-タグ関連を作成する。
 *
 * **関所を通す。** タグは利用者ごとの分類ではなく解答用紙そのものの属性
 * （`AsbDefinitionTag` は `userId` を持たない）なので、他の編集と扱いを分ける理由が
 * 無い。通さないと、担当でない教員が一覧から他人の解答用紙へタグを付けられるうえ、
 * 親の更新日時が繰り上がらず一覧の並べ替えや期間の絞り込みが古いまま残る。
 */
export async function createAsbDefinitionTag(data: {
  asbDefinitionId: string
  tagId: string
}): Promise<void> {
  const tagChange: AsbDefinitionTagChange = { definition: null, afterTags: [] }
  await writeAsbDefinitionContent(data.asbDefinitionId, async (tx) => {
    tagChange.definition = await tx.asbDefinition.findUnique({
      where: { id: data.asbDefinitionId },
      include: asbDefinitionWithTagsInclude,
    })
    const created = await tx.asbDefinitionTag.create({
      data,
      include: { tag: true },
    })
    tagChange.afterTags = [
      ...(tagChange.definition?.tags ?? []).map((link) => link.tag),
      created.tag,
    ]
    return true
  })

  await recordAsbDefinitionTagAudit(tagChange)
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
): Promise<void> {
  const tagChange: AsbDefinitionTagChange = { definition: null, afterTags: [] }
  await writeAsbDefinitionContent(asbDefinitionId, async (tx) => {
    tagChange.definition = await tx.asbDefinition.findUnique({
      where: { id: asbDefinitionId },
      include: asbDefinitionWithTagsInclude,
    })
    const current = tagChange.definition?.tags ?? []
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

    const afterLinks = await tx.asbDefinitionTag.findMany({
      where: { asbDefinitionId },
      include: { tag: true },
    })
    tagChange.afterTags = afterLinks.map((link) => link.tag)

    // 触った行があるときだけ、親の更新日時を繰り上げる
    return removed.length > 0 || added.length > 0
  })

  await recordAsbDefinitionTagAudit(tagChange)
}
