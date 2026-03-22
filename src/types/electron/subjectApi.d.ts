/**
 * Subject（教科）・SubjectSubtotalGroup関連API
 */
export interface SubjectAPI {
  subjectGetAll: () => Promise<
    Array<{ id: string; name: string; createdAt: Date; updatedAt: Date }>
  >
  subjectGetById: (id: string) => Promise<{
    id: string
    name: string
    createdAt: Date
    updatedAt: Date
  } | null>
  subjectCreate: (data: {
    name: string
  }) => Promise<{ id: string; name: string; createdAt: Date; updatedAt: Date }>
  subjectUpdate: (
    id: string,
    data: { name: string }
  ) => Promise<{ id: string; name: string; createdAt: Date; updatedAt: Date }>
  subjectDelete: (id: string) => Promise<void>

  subjectSubtotalGroupGetBySubjectId: (subjectId: string) => Promise<
    Array<{
      id: string
      subjectId: string
      subtotalGroupId: string
      createdAt: Date
      updatedAt: Date
    }>
  >
  subjectSubtotalGroupCreate: (data: {
    subjectId: string
    subtotalGroupId: string
  }) => Promise<{
    id: string
    subjectId: string
    subtotalGroupId: string
    createdAt: Date
    updatedAt: Date
  }>
  subjectSubtotalGroupDelete: (id: string) => Promise<void>
}
