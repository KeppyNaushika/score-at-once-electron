/**
 * AsbDefinitionTag（解答用紙定義-タグ関連）のPrisma操作関数
 */

import { writeAsbDefinitionContent } from "./asbDefinitionWrite"
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
 * 解答用紙定義-タグ関連を作成する。
 *
 * **関所を通す。** タグは利用者ごとの分類ではなく解答用紙そのものの属性
 * （`AsbDefinitionTag` は `userId` を持たない）なので、他の編集と扱いを分ける理由が
 * 無い。通さないと、担当でない教員が一覧から他人の解答用紙へタグを付けられるうえ、
 * 親の更新日時が繰り上がらず一覧の並べ替えや期間の絞り込みが古いまま残る
 * （docs/branch-review-findings.md #10）。
 */
export async function createAsbDefinitionTag(data: {
  asbDefinitionId: string
  tagId: string
}): Promise<void> {
  await writeAsbDefinitionContent(data.asbDefinitionId, async (tx) => {
    await tx.asbDefinitionTag.create({ data })
    return true
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
): Promise<void> {
  await writeAsbDefinitionContent(asbDefinitionId, async (tx) => {
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

    // 触った行があるときだけ、親の更新日時を繰り上げる
    return removed.length > 0 || added.length > 0
  })
}
