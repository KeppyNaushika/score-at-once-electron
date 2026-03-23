/**
 * Tag（タグ）・TagSubtotalGroup・ExamTag関連API
 */

interface TagRecord {
  id: string
  name: string
  order: number
  color: string | null
  createdAt: Date
  updatedAt: Date
}

export interface TagAPI {
  tagGetAll: () => Promise<TagRecord[]>
  tagGetById: (id: string) => Promise<TagRecord | null>
  tagCreate: (data: { name: string; color?: string }) => Promise<TagRecord>
  tagUpdate: (
    id: string,
    data: { name?: string; color?: string | null }
  ) => Promise<TagRecord>
  tagDelete: (id: string) => Promise<void>
  tagFindOrCreate: (name: string) => Promise<TagRecord>
  tagReorder: (tagIds: string[]) => Promise<TagRecord[]>

  tagSubtotalGroupGetByTagId: (tagId: string) => Promise<
    Array<{
      id: string
      tagId: string
      subtotalGroupId: string
      createdAt: Date
      updatedAt: Date
    }>
  >
  tagSubtotalGroupCreate: (data: {
    tagId: string
    subtotalGroupId: string
  }) => Promise<{
    id: string
    tagId: string
    subtotalGroupId: string
    createdAt: Date
    updatedAt: Date
  }>
  tagSubtotalGroupDelete: (id: string) => Promise<void>

  examTagGetByExamId: (examId: string) => Promise<
    Array<{
      id: string
      examId: string
      tagId: string
      tag: TagRecord
      createdAt: Date
      updatedAt: Date
    }>
  >
  examTagCreate: (data: { examId: string; tagId: string }) => Promise<{
    id: string
    examId: string
    tagId: string
    createdAt: Date
    updatedAt: Date
  }>
  examTagDelete: (id: string) => Promise<void>
  examTagSetExamTags: (
    examId: string,
    tagIds: string[]
  ) => Promise<
    Array<{
      id: string
      examId: string
      tagId: string
      tag: TagRecord
      createdAt: Date
      updatedAt: Date
    }>
  >
}
