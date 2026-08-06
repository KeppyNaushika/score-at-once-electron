import type {
  CropRegion,
  ExamSubtotalGroup,
  Prisma,
  UserExam,
} from "@prisma/client"

import type {
  CropRegionWithSubtotals,
  CropRegionWithSubtotalsAndScores,
} from "@/electron-src/lib/prisma/cropRegion"
import type { CropSubtotalWithSubtotalGroup } from "@/electron-src/lib/prisma/cropSubtotal"
import type {
  subtotalGroupForScoringInclude,
  SubtotalGroupWithSubtotals,
  SubtotalGroupWithSubtotalsExamsAndTags,
} from "@/electron-src/lib/prisma/subtotalGroup"

import type { CropRegionAreaType } from "../cropRegionAreaType.types"

// CropRegion作成/更新用の引数型
export type SaveCropRegionArgs = Omit<
  Prisma.CropRegionUncheckedCreateInput,
  "id" | "createdAt" | "updatedAt"
> & { id?: string; examPageId: string }

/**
 * CropRegion 作成引数（IPC）。CreateManyInput（スカラーのみ）から生成列を減算し、
 * type は SSOT の CropRegionAreaType へ narrowing 注入する。
 */
export type CreateCropRegionArgs = Omit<
  Prisma.CropRegionCreateManyInput,
  "id" | "createdAt" | "updatedAt" | "type"
> & { type: CropRegionAreaType }

/**
 * CropRegion 更新引数（IPC）。examPageId を除く可変列の部分集合＋type union。
 */
export type UpdateCropRegionArgs = Partial<
  Omit<
    Prisma.CropRegionCreateManyInput,
    "id" | "examPageId" | "createdAt" | "updatedAt" | "type"
  >
> & { type?: CropRegionAreaType }

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
 * CropRegion・SubtotalGroup・CropSubtotal・UserExam・ExamSubtotalGroup関連API
 */
export interface CropRegionAPI {
  // CropRegion related (updated from LayoutRegion)
  createCropRegion: (
    data: Prisma.CropRegionUncheckedCreateInput
  ) => Promise<CropRegionWithSubtotals>
  updateCropRegion: (
    id: string,
    data: Prisma.CropRegionUpdateInput
  ) => Promise<CropRegionWithSubtotals>
  deleteCropRegion: (id: string) => Promise<CropRegion | void>
  getCropRegionsByExamId: (
    examId: string
  ) => Promise<CropRegionWithSubtotalsAndScores[]>
  getQuestionAnswerRegionsByExamId: (
    examId: string
  ) => Promise<CropRegionWithSubtotalsAndScores[]>
  updateCropRegionOrders: (
    updates: Array<{ id: string; orderIndex: number }>
  ) => Promise<CropRegion[]>

  // SubtotalGroup related
  getSubtotalGroups: () => Promise<{
    success: boolean
    subtotalGroups?: SubtotalGroupWithSubtotalsExamsAndTags[]
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
    subtotalGroup?: SubtotalGroupWithSubtotals
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
    subtotalGroup?: SubtotalGroupWithSubtotals
    error?: string
  }>
  deleteSubtotalGroup: (id: string) => Promise<{
    success: boolean
    error?: string
  }>
  getAvailableSubtotalGroupsForExam: (examId: string) => Promise<{
    success: boolean
    subtotalGroups?: SubtotalGroupWithSubtotals[]
    error?: string
  }>
  getActiveSubtotalGroupsForExam: (examId: string) => Promise<{
    success: boolean
    examSubtotalGroups?: Prisma.ExamSubtotalGroupGetPayload<{
      include: {
        subtotalGroup: { include: typeof subtotalGroupForScoringInclude }
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

  // CropSubtotal related
  createManyCropSubtotals: (
    assignments: Prisma.CropSubtotalUncheckedCreateInput[]
  ) => Promise<Prisma.BatchPayload>
  deleteCropSubtotalsByCropRegionId: (
    cropRegionId: string
  ) => Promise<Prisma.BatchPayload>
  getCropSubtotalsByCropRegionId: (
    cropRegionId: string
  ) => Promise<CropSubtotalWithSubtotalGroup[]>

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
