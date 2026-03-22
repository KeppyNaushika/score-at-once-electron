import type {
  CropRegion,
  CropSubtotal,
  ExamSubtotalGroup,
  Prisma,
  Subtotal,
  SubtotalGroup,
  UserExam,
} from "@prisma/client"

import type {
  CropRegionWithDetails,
  CropSubtotalWithRelations,
  SubtotalGroupWithItems,
  SubtotalWithDetails,
} from "../prismaExtensions"

// CropRegion作成/更新用の引数型
export type SaveCropRegionArgs = Omit<
  Prisma.CropRegionUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt"
> & { id?: string; examPageId: string }

// SubtotalGroup作成/更新用の引数型
export type CreateSubtotalGroupArgs = Omit<
  Prisma.SubtotalGroupUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt"
>
export type UpdateSubtotalGroupArgs = Partial<CreateSubtotalGroupArgs> & {
  id: string
}

// Subtotal作成/更新用の引数型
export type CreateSubtotalArgs = Omit<
  Prisma.SubtotalUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt" | "subtotalGroupId"
>
export type UpdateSubtotalArgs = Partial<CreateSubtotalArgs> & { id: string }

// Backward compatibility aliases for args types
export type CreateQuestionGroupArgs = CreateSubtotalGroupArgs
export type UpdateQuestionGroupArgs = UpdateSubtotalGroupArgs
export type CreateQuestionGroupItemArgs = CreateSubtotalArgs
export type UpdateQuestionGroupItemArgs = UpdateSubtotalArgs

// CropSubtotal作成用の引数型
export type CreateCropSubtotalArgs = Omit<
  Prisma.CropSubtotalUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt"
>

// Backward compatibility aliases for args types
export type CreateSubtotalDefinitionArgs = CreateCropSubtotalArgs
export type CreateQuestionSubtotalAssignmentArgs = CreateCropSubtotalArgs

/**
 * CropRegion・SubtotalGroup・Subtotal・CropSubtotal・UserExam・ExamSubtotalGroup関連API
 */
export interface CropRegionAPI {
  // CropRegion related (updated from LayoutRegion)
  createCropRegion: (
    data: Prisma.CropRegionUncheckedCreateInput
  ) => Promise<CropRegionWithDetails>
  createManyCropRegions: (
    data: Prisma.CropRegionCreateManyInput[]
  ) => Promise<Prisma.BatchPayload>
  updateCropRegion: (
    id: string,
    data: Prisma.CropRegionUpdateInput
  ) => Promise<CropRegionWithDetails>
  deleteCropRegion: (id: string) => Promise<CropRegion | void>
  getCropRegionsByExamId: (examId: string) => Promise<CropRegionWithDetails[]>
  getQuestionAnswerRegionsByExamId: (
    examId: string
  ) => Promise<CropRegionWithDetails[]>
  getCropRegionById: (id: string) => Promise<CropRegionWithDetails | null>
  updateCropRegionOrders: (
    updates: Array<{ id: string; orderIndex: number }>
  ) => Promise<CropRegion[]>

  // Backward compatibility aliases
  createLayoutRegion: (
    data: Prisma.CropRegionUncheckedCreateInput
  ) => Promise<CropRegionWithDetails>
  createManyLayoutRegions: (
    data: Prisma.CropRegionCreateManyInput[]
  ) => Promise<Prisma.BatchPayload>
  updateLayoutRegion: (
    id: string,
    data: Prisma.CropRegionUpdateInput
  ) => Promise<CropRegionWithDetails>
  deleteLayoutRegion: (id: string) => Promise<CropRegion | void>
  getLayoutRegionsByExamId: (examId: string) => Promise<CropRegionWithDetails[]>
  getLayoutRegionById: (id: string) => Promise<CropRegionWithDetails | null>
  updateLayoutRegionOrders: (
    updates: Array<{ id: string; orderIndex: number }>
  ) => Promise<CropRegion[]>

  // SubtotalGroup related (updated from QuestionGroup)
  getSubtotalGroups: () => Promise<{
    success: boolean
    subtotalGroups?: SubtotalGroupWithItems[]
    error?: string
  }>
  createSubtotalGroup: (data: {
    name: string
    subtotals: {
      name: string
      order: number
    }[]
  }) => Promise<{
    success: boolean
    subtotalGroup?: SubtotalGroupWithItems
    error?: string
  }>
  updateSubtotalGroup: (
    id: string,
    data: {
      name: string
      subtotals: {
        name: string
        order: number
      }[]
    }
  ) => Promise<{
    success: boolean
    subtotalGroup?: SubtotalGroupWithItems
    error?: string
  }>
  deleteSubtotalGroup: (id: string) => Promise<{
    success: boolean
    error?: string
  }>
  getSubtotalGroupsByExamId: (
    examId: string
  ) => Promise<SubtotalGroupWithItems[]>
  getSubtotalGroupById: (id: string) => Promise<SubtotalGroupWithItems | null>
  getAvailableSubtotalGroupsForExam: (examId: string) => Promise<{
    success: boolean
    subtotalGroups?: SubtotalGroupWithItems[]
    error?: string
  }>
  getActiveSubtotalGroupsForExam: (examId: string) => Promise<{
    success: boolean
    examSubtotalGroups?: Prisma.ExamSubtotalGroupGetPayload<{
      include: {
        subtotalGroup: {
          include: {
            subtotals: true
          }
        }
      }
    }>[]
    error?: string
  }>
  addSubtotalGroupToExam: (
    examId: string,
    subtotalGroupId: string
  ) => Promise<{
    success: boolean
    examSubtotalGroup?: Prisma.ExamSubtotalGroupGetPayload<{
      include: {
        subtotalGroup: {
          include: {
            subtotals: true
          }
        }
      }
    }>
    error?: string
  }>
  removeSubtotalGroupFromExam: (
    examId: string,
    subtotalGroupId: string
  ) => Promise<{
    success: boolean
    error?: string
  }>

  // Backward compatibility aliases
  createQuestionGroup: (
    data: Prisma.SubtotalGroupUncheckedCreateInput
  ) => Promise<SubtotalGroupWithItems>
  updateQuestionGroup: (
    id: string,
    data: Prisma.SubtotalGroupUpdateInput
  ) => Promise<SubtotalGroupWithItems>
  deleteQuestionGroup: (id: string) => Promise<SubtotalGroup | void>
  getQuestionGroupsByExamId: (
    examId: string
  ) => Promise<SubtotalGroupWithItems[]>
  getQuestionGroupById: (id: string) => Promise<SubtotalGroupWithItems | null>

  // Subtotal related (updated from QuestionGroupItem)
  createSubtotal: (
    data: Prisma.SubtotalUncheckedCreateInput
  ) => Promise<SubtotalWithDetails>
  createManySubtotals: (
    items: Prisma.SubtotalUncheckedCreateInput[]
  ) => Promise<Prisma.BatchPayload>
  updateSubtotal: (
    id: string,
    data: Prisma.SubtotalUpdateInput
  ) => Promise<SubtotalWithDetails>
  deleteSubtotal: (id: string) => Promise<Subtotal | void>
  getSubtotalsByGroupId: (
    subtotalGroupId: string
  ) => Promise<SubtotalWithDetails[]>
  getSubtotalById: (id: string) => Promise<SubtotalWithDetails | null>
  updateSubtotalOrders: (
    orders: { id: string; order: number }[]
  ) => Promise<Prisma.BatchPayload>

  // Backward compatibility aliases
  createQuestionGroupItem: (
    data: Prisma.SubtotalUncheckedCreateInput
  ) => Promise<SubtotalWithDetails>
  createManyQuestionGroupItems: (
    items: Prisma.SubtotalUncheckedCreateInput[]
  ) => Promise<Prisma.BatchPayload>
  updateQuestionGroupItem: (
    id: string,
    data: Prisma.SubtotalUpdateInput
  ) => Promise<SubtotalWithDetails>
  deleteQuestionGroupItem: (id: string) => Promise<Subtotal | void>
  getQuestionGroupItemsByGroupId: (
    questionGroupId: string
  ) => Promise<SubtotalWithDetails[]>
  getQuestionGroupItemById: (id: string) => Promise<SubtotalWithDetails | null>
  updateQuestionGroupItemOrders: (
    orders: { id: string; order: number }[]
  ) => Promise<Prisma.BatchPayload>

  // CropSubtotal related (unified from SubtotalDefinition)
  createCropSubtotal: (
    data: Prisma.CropSubtotalUncheckedCreateInput
  ) => Promise<CropSubtotalWithRelations>
  createManyCropSubtotals: (
    assignments: Prisma.CropSubtotalUncheckedCreateInput[]
  ) => Promise<Prisma.BatchPayload>
  deleteCropSubtotal: (id: string) => Promise<CropSubtotal | void>
  deleteCropSubtotalsByCropRegionId: (
    cropRegionId: string
  ) => Promise<Prisma.BatchPayload>
  getCropSubtotalsByCropRegionId: (
    cropRegionId: string
  ) => Promise<CropSubtotalWithRelations[]>
  getCropSubtotalsBySubtotalId: (
    subtotalId: string
  ) => Promise<CropSubtotalWithRelations[]>

  // Backward compatibility aliases
  createSubtotalDefinition: (
    data: Prisma.CropSubtotalUncheckedCreateInput
  ) => Promise<CropSubtotalWithRelations>
  createManySubtotalDefinitions: (
    definitions: Prisma.CropSubtotalUncheckedCreateInput[]
  ) => Promise<Prisma.BatchPayload>
  deleteSubtotalDefinition: (id: string) => Promise<CropSubtotal | void>
  deleteSubtotalDefinitionsByCropRegionId: (
    cropRegionId: string
  ) => Promise<Prisma.BatchPayload>
  getSubtotalDefinitionsByCropRegionId: (
    cropRegionId: string
  ) => Promise<CropSubtotalWithRelations[]>

  // Backward compatibility aliases
  deleteSubtotalDefinitionsByLayoutRegionId: (
    cropRegionId: string
  ) => Promise<Prisma.BatchPayload>
  getSubtotalDefinitionsByQuestionGroupItemId: (
    questionGroupItemId: string
  ) => Promise<CropSubtotalWithRelations[]>

  // UserExam and ExamSubtotalGroup related (new many-to-many relations)
  createUserExam: (
    data: Prisma.UserExamUncheckedCreateInput
  ) => Promise<
    Prisma.UserExamGetPayload<{ include: { user: true; exam: true } }>
  >
  deleteUserExam: (id: string) => Promise<UserExam | void>
  getUserExamsByUserId: (
    userId: string
  ) => Promise<Prisma.UserExamGetPayload<{ include: { exam: true } }>[]>
  getUserExamsByExamId: (
    examId: string
  ) => Promise<Prisma.UserExamGetPayload<{ include: { user: true } }>[]>

  createExamSubtotalGroup: (
    data: Prisma.ExamSubtotalGroupUncheckedCreateInput
  ) => Promise<
    Prisma.ExamSubtotalGroupGetPayload<{
      include: { exam: true; subtotalGroup: true }
    }>
  >
  deleteExamSubtotalGroup: (id: string) => Promise<ExamSubtotalGroup | void>
  getExamSubtotalGroupsByExamId: (examId: string) => Promise<
    Prisma.ExamSubtotalGroupGetPayload<{
      include: { subtotalGroup: { include: { subtotals: true } } }
    }>[]
  >

  // Backward compatibility aliases (redirects to CropSubtotal)
  createQuestionSubtotalAssignment: (
    data: Prisma.CropSubtotalUncheckedCreateInput
  ) => Promise<CropSubtotalWithRelations>
  createManyQuestionSubtotalAssignments: (
    assignments: Prisma.CropSubtotalUncheckedCreateInput[]
  ) => Promise<Prisma.BatchPayload>
  deleteQuestionSubtotalAssignment: (id: string) => Promise<CropSubtotal | void>
  deleteAssignmentsByQuestionCropRegionId: (
    questionCropRegionId: string
  ) => Promise<Prisma.BatchPayload>

  // Backward compatibility alias
  deleteAssignmentsByQuestionLayoutRegionId: (
    questionLayoutRegionId: string
  ) => Promise<Prisma.BatchPayload>
  deleteAssignmentsByQuestionGroupItemId: (
    questionGroupItemId: string
  ) => Promise<Prisma.BatchPayload>
  getAssignmentsByQuestionCropRegionId: (
    questionCropRegionId: string
  ) => Promise<CropSubtotalWithRelations[]>
  getAssignmentsByQuestionGroupItemId: (
    questionGroupItemId: string
  ) => Promise<CropSubtotalWithRelations[]>
}
