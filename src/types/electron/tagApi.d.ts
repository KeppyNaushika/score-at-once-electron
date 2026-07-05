import type { ExamTag, Prisma, Tag, TagSubtotalGroup } from "@prisma/client"

/**
 * Tag（タグ）・TagSubtotalGroup・ExamTag関連API
 */

/** タグ同梱の ExamTag（`examTagGetByExamId`/`examTagSetExamTags` が返す実形状）。 */
export type ExamTagWithTag = Prisma.ExamTagGetPayload<{
  include: { tag: true }
}>

export interface TagAPI {
  tagGetAll: () => Promise<Tag[]>
  tagGetById: (id: string) => Promise<Tag | null>
  tagCreate: (data: { name: string; color?: string }) => Promise<Tag>
  tagUpdate: (
    id: string,
    data: { name?: string; color?: string | null }
  ) => Promise<Tag>
  tagDelete: (id: string) => Promise<void>
  tagFindOrCreate: (name: string) => Promise<Tag>
  tagReorder: (tagIds: string[]) => Promise<Tag[]>

  tagSubtotalGroupGetByTagId: (tagId: string) => Promise<TagSubtotalGroup[]>
  tagSubtotalGroupCreate: (data: {
    tagId: string
    subtotalGroupId: string
  }) => Promise<TagSubtotalGroup>
  tagSubtotalGroupDelete: (id: string) => Promise<void>

  examTagGetByExamId: (examId: string) => Promise<ExamTagWithTag[]>
  examTagCreate: (data: { examId: string; tagId: string }) => Promise<ExamTag>
  examTagDelete: (id: string) => Promise<void>
  examTagSetExamTags: (
    examId: string,
    tagIds: string[]
  ) => Promise<ExamTagWithTag[]>
}
