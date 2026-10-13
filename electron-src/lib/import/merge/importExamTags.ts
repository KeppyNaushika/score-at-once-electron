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

type ArchiveTag = NonNullable<ExtractedArchiveData["tagsData"]>["tags"][number]

/**
 * タグ・タグと小計グループの結び付き・試験のタグ付けを取り込む。
 *
 * **id が一致すれば同じ行。** タグはまず id で引き、在れば規則どおり名前・表示順・色を書く。
 * id で無ければ名前で引く（Tag.name は unique なので、同じ名前のタグを別に作れない）。
 * id で一致したタグを先に全部書くのは、改名されたタグが手放した名前を、同じ名前の別の
 * タグが使えるようにするため。名前を書くと別のタグと重なるなら、名前は変えずに伝える。
 */
export async function processTags(
  data: ExtractedArchiveData,
  idMappings: IdMappings,
  warnings: string[],
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  if (!data.tagsData) return
  const tagIdMapping: Record<string, string> = {}

  /** 同じタグだと決まった既存の行へ、規則に従って値を書く */
  const applyTagColumns = async (
    tag: ArchiveTag,
    existing: { id: string; name: string; updatedAt: Date }
  ): Promise<void> => {
    tagIdMapping[tag.id] = existing.id
    const updatedAt = replacementUpdatedAt(
      policy,
      tag.updatedAt,
      existing.updatedAt
    )
    if (!updatedAt) return
    const nameTaken =
      existing.name !== tag.name &&
      (await tx.tag.findUnique({ where: { name: tag.name } })) !== null
    if (nameTaken) {
      warnings.push(
        `タグ「${existing.name}」の名前を「${tag.name}」に変えると別のタグと重なるため、名前は変えていません`
      )
    }
    await tx.tag.update({
      where: { id: existing.id },
      data: {
        ...(nameTaken ? {} : { name: tag.name }),
        // 表示順と色もタグの持ち物。旧アーカイブ（〜v1.10.0）は持たないので既定へ倒す
        order: tag.order ?? 0,
        color: tag.color ?? null,
        updatedAt,
      },
    })
  }

  // 1. id で一致したタグ
  const unmatchedTags: ArchiveTag[] = []
  for (const tag of data.tagsData.tags) {
    const existingById = await tx.tag.findUnique({ where: { id: tag.id } })
    if (existingById) {
      await applyTagColumns(tag, existingById)
    } else {
      unmatchedTags.push(tag)
    }
  }

  // 2. id で一致しなかったタグは名前で引き、無ければアーカイブの id で作る
  for (const tag of unmatchedTags) {
    const existingByName = await tx.tag.findUnique({
      where: { name: tag.name },
    })
    if (existingByName) {
      await applyTagColumns(tag, existingByName)
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

    // 結び付き自体に値の列は無い。id が一致した行は親（タグ・グループ）を書く
    const pairKey = {
      tagId_subtotalGroupId: { tagId: newTagId, subtotalGroupId: newGroupId },
    }
    const existingById = await tx.tagSubtotalGroup.findUnique({
      where: { id: tagSubtotalGroup.id },
    })
    if (existingById) {
      const updatedAt = replacementUpdatedAt(
        policy,
        tagSubtotalGroup.updatedAt,
        existingById.updatedAt
      )
      if (
        updatedAt &&
        (existingById.tagId !== newTagId ||
          existingById.subtotalGroupId !== newGroupId) &&
        (await tx.tagSubtotalGroup.findUnique({ where: pairKey })) === null
      ) {
        await tx.tagSubtotalGroup.update({
          where: { id: existingById.id },
          data: { tagId: newTagId, subtotalGroupId: newGroupId, updatedAt },
        })
      }
      continue
    }
    if (await tx.tagSubtotalGroup.findUnique({ where: pairKey })) continue

    await tx.tagSubtotalGroup.create({
      data: {
        id: tagSubtotalGroup.id,
        tagId: newTagId,
        subtotalGroupId: newGroupId,
        ...policy.createdTimestamps(tagSubtotalGroup),
      },
    })
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

      const pairKey = { examId_tagId: { examId: newExamId, tagId: newTagId } }
      const existingById = await tx.examTag.findUnique({
        where: { id: examTag.id },
      })
      if (existingById) {
        const updatedAt = replacementUpdatedAt(
          policy,
          examTag.updatedAt,
          existingById.updatedAt
        )
        if (
          updatedAt &&
          (existingById.examId !== newExamId ||
            existingById.tagId !== newTagId) &&
          (await tx.examTag.findUnique({ where: pairKey })) === null
        ) {
          await tx.examTag.update({
            where: { id: existingById.id },
            data: { examId: newExamId, tagId: newTagId, updatedAt },
          })
        }
        continue
      }
      if (await tx.examTag.findUnique({ where: pairKey })) continue

      await tx.examTag.create({
        data: {
          id: examTag.id,
          examId: newExamId,
          tagId: newTagId,
          ...policy.createdTimestamps(examTag),
        },
      })
    }

    if (unresolvedTagIdCount > 0) {
      warnings.push(
        `${unresolvedTagIdCount}件のタグ付けを取り込めませんでした（アーカイブにタグ本体が含まれていません）。`
      )
    }
  }
}
