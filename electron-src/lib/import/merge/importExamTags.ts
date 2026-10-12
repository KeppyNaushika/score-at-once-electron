/**
 * ID統合インポート: タグ（Tag / TagSubtotalGroup / ExamTag）の処理
 *
 * **値の扱いは importValuePolicy に一本化されている**（上書きする／統合する／別で追加する）。
 * 既にある行を置き換えるかどうかも、新しく作る行の時刻も、この規則だけで決まる。
 */

import type { ExtractedArchiveData } from "../exam-archive/archiveExtractor"
import type { ImportValuePolicy } from "./importValuePolicy"
import { replacementUpdatedAt } from "./importValuePolicy"
import type { IdMappings, PrismaTransaction } from "./types"

export async function processTags(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  warnings: string[],
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  if (!data.tagsData) return
  const tagIdMapping: Record<string, string> = {}

  for (const tag of data.tagsData.tags) {
    // タグは名前が同一性そのもの（同じ名前のタグを2つ持つ意味が無い）
    const existing =
      (await tx.tag.findUnique({ where: { name: tag.name } })) ??
      (await tx.tag.findUnique({ where: { id: tag.id } }))

    if (existing) {
      tagIdMapping[tag.id] = existing.id
      const updatedAt = replacementUpdatedAt(
        policy,
        tag.updatedAt,
        existing.updatedAt
      )
      if (updatedAt) {
        await tx.tag.update({
          where: { id: existing.id },
          data: {
            name: tag.name,
            // 表示順と色もタグの持ち物。旧アーカイブ（〜v1.10.0）は持たないので既定へ倒す
            order: tag.order ?? 0,
            color: tag.color ?? null,
            updatedAt,
          },
        })
      }
      continue
    }

    await tx.tag.create({
      data: {
        id: tag.id,
        name: tag.name,
        order: tag.order ?? 0,
        color: tag.color ?? null,
        ...policy.createdTimestamps(tag),
      },
    })
    tagIdMapping[tag.id] = tag.id
  }

  for (const tagSubtotalGroup of data.tagsData.tagSubtotalGroups) {
    const newTagId = tagIdMapping[tagSubtotalGroup.tagId]
    const newGroupId =
      idMappings.subtotalGroup[tagSubtotalGroup.subtotalGroupId]
    if (!newTagId || !newGroupId) continue

    // 結び付き自体に列が無いので、あれば何もしない（置き換える値が無い）
    const existing = await tx.tagSubtotalGroup.findFirst({
      where: { tagId: newTagId, subtotalGroupId: newGroupId },
    })
    if (existing) continue

    const existingById = await tx.tagSubtotalGroup.findUnique({
      where: { id: tagSubtotalGroup.id },
    })
    if (!existingById) {
      await tx.tagSubtotalGroup.create({
        data: {
          id: tagSubtotalGroup.id,
          tagId: newTagId,
          subtotalGroupId: newGroupId,
          ...policy.createdTimestamps(tagSubtotalGroup),
        },
      })
    }
  }

  // ExamTag処理
  const newExamId = idMappings.exam[data.examData.exam.id]
  if (newExamId) {
    // 指す先の Tag がアーカイブに無いタグ付けは作れない。**黙って捨てず数えて伝える** —
    // 書き出し側が tags を集め損ねていた頃、ここが警告なしに全件を落としていた
    let unresolvedTagIdCount = 0
    for (const examTag of data.tagsData.examTags) {
      const newTagId = tagIdMapping[examTag.tagId]
      if (!newTagId) {
        unresolvedTagIdCount++
        continue
      }

      const existing = await tx.examTag.findFirst({
        where: { examId: newExamId, tagId: newTagId },
      })
      if (existing) continue

      const existingById = await tx.examTag.findUnique({
        where: { id: examTag.id },
      })
      if (!existingById) {
        await tx.examTag.create({
          data: {
            id: examTag.id,
            examId: newExamId,
            tagId: newTagId,
            ...policy.createdTimestamps(examTag),
          },
        })
      }
    }

    if (unresolvedTagIdCount > 0) {
      warnings.push(
        `${unresolvedTagIdCount}件のタグ付けを取り込めませんでした（アーカイブにタグ本体が含まれていません）。`
      )
    }
  }
}
