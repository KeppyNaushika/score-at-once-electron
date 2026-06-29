import type {
  CropRegion,
  CropSubtotal,
  ExamSubtotalGroup,
  Prisma,
  Subtotal,
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

// CropSubtotal作成用の引数型
export type CreateCropSubtotalArgs = Omit<
  Prisma.CropSubtotalUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt"
>

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

  // SubtotalGroup related
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
  getSubtotalGroupSelection: (examId: string) => Promise<{
    success: boolean
    tableGroupIds: string[]
    boxPlotGroupIds: string[]
    error?: string
  }>
  setSubtotalGroupSelection: (
    examId: string,
    tableGroupIds: string[],
    boxPlotGroupIds: string[]
  ) => Promise<{
    success: boolean
    error?: string
  }>

  // Subtotal related
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

  // CropSubtotal related
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

  // UserExam and ExamSubtotalGroup related
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
}
