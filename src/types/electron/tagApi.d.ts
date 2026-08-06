import type { AsbDefinitionTag, ExamTag, Prisma, Tag } from "@prisma/client"

import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import type {
  TagSubtotalGroupWithSubtotalGroup,
  TagSubtotalGroupWithTag,
} from "@/electron-src/lib/prisma/tagSubtotalGroup"

/**
 * Tag（タグ）・TagSubtotalGroup・ExamTag関連API
 */

/** タグ同梱の ExamTag（`examTagGetByExamId`/`examTagSetExamTags` が返す実形状）。 */
export type ExamTagWithTag = Prisma.ExamTagGetPayload<{
  include: { tag: true }
}>

/** タグ同梱の AsbDefinitionTag（getByDefinitionId/setDefinitionTags が返す実形状）。 */
export type AsbDefinitionTagWithTag = Prisma.AsbDefinitionTagGetPayload<{
  include: { tag: true }
}>

export interface TagAPI {
  tagGetAll: () => Promise<TagWithAllRelations[]>
  tagCreate: (data: { name: string; color?: string }) => Promise<Tag>
  tagUpdate: (
    id: string,
    data: { name?: string; color?: string | null }
  ) => Promise<Tag>
  tagDelete: (id: string) => Promise<void>
  tagFindOrCreate: (name: string) => Promise<Tag>
  tagReorder: (tagIds: string[]) => Promise<Tag[]>

  tagSubtotalGroupGetByTagId: (
    tagId: string
  ) => Promise<TagSubtotalGroupWithSubtotalGroup[]>
  tagSubtotalGroupSetTags: (
    subtotalGroupId: string,
    tagIds: string[]
  ) => Promise<TagSubtotalGroupWithTag[]>

  examTagGetByExamId: (examId: string) => Promise<ExamTagWithTag[]>
  examTagCreate: (data: { examId: string; tagId: string }) => Promise<ExamTag>
  examTagSetExamTags: (
    examId: string,
    tagIds: string[]
  ) => Promise<ExamTagWithTag[]>

  asbDefinitionTagGetByDefinitionId: (
    asbDefinitionId: string
  ) => Promise<AsbDefinitionTagWithTag[]>
  asbDefinitionTagCreate: (data: {
    asbDefinitionId: string
    tagId: string
  }) => Promise<AsbDefinitionTag>
  asbDefinitionTagSetDefinitionTags: (
    asbDefinitionId: string,
    tagIds: string[]
  ) => Promise<AsbDefinitionTagWithTag[]>
}
