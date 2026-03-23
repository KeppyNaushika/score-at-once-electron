/**
 * Tag（タグ）・TagSubtotalGroup・ExamTag関連API
 */
export interface TagAPI {
  tagGetAll: () => Promise<
    Array<{ id: string; name: string; createdAt: Date; updatedAt: Date }>
  >
  tagGetById: (id: string) => Promise<{
    id: string
    name: string
    createdAt: Date
    updatedAt: Date
  } | null>
  tagCreate: (data: {
    name: string
  }) => Promise<{ id: string; name: string; createdAt: Date; updatedAt: Date }>
  tagUpdate: (
    id: string,
    data: { name: string }
  ) => Promise<{ id: string; name: string; createdAt: Date; updatedAt: Date }>
  tagDelete: (id: string) => Promise<void>

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
      tag: { id: string; name: string; createdAt: Date; updatedAt: Date }
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
      tag: { id: string; name: string; createdAt: Date; updatedAt: Date }
      createdAt: Date
      updatedAt: Date
    }>
  >
}
