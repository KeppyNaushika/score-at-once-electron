import { Prisma } from "@prisma/client"

import {
  createCropRegion as dbCreateCropRegion,
  createManyCropRegions as dbCreateManyCropRegions,
  deleteCropRegion as dbDeleteCropRegion,
  getCropRegionById as dbGetCropRegionById,
  getCropRegionsByExamId as dbGetCropRegionsByExamId,
  getQuestionAnswerRegionsByExamId as dbGetQuestionAnswerRegionsByExamId,
  updateCropRegion as dbUpdateCropRegion,
  updateCropRegionOrders as dbUpdateCropRegionOrders,
} from "../lib/prisma/cropRegion"

/**
 * QuestionScoreをIPC用にシリアライズ（DecimalをnumberにDateはそのまま）
 */
function serializeQuestionScore(score: {
  id: string
  cropRegionId: string
  studentId: string | null
  partialScore: { toNumber(): number } | null
  status: string
  userId: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: score.id,
    cropRegionId: score.cropRegionId,
    studentId: score.studentId,
    partialScore: score.partialScore ? score.partialScore.toNumber() : null,
    status: score.status,
    userId: score.userId,
    createdAt: score.createdAt,
    updatedAt: score.updatedAt,
  }
}

/**
 * CropRegionをIPC用にシリアライズ（questionScoresのDecimalを変換）
 */
function serializeCropRegion<
  T extends {
    questionScores?: Array<{
      id: string
      cropRegionId: string
      studentId: string | null
      partialScore: { toNumber(): number } | null
      status: string
      userId: string | null
      createdAt: Date
      updatedAt: Date
    }>
  },
>(region: T) {
  return {
    ...region,
    questionScores: region.questionScores?.map(serializeQuestionScore) || [],
  }
}

import {
  createCropSubtotal as dbCreateCropSubtotal,
  createManyCropSubtotals as dbCreateManyCropSubtotals,
  deleteCropSubtotal as dbDeleteCropSubtotal,
  deleteCropSubtotalsByCropRegionId as dbDeleteCropSubtotalsByCropRegionId,
  getCropSubtotalsByCropRegionId as dbGetCropSubtotalsByCropRegionId,
  getCropSubtotalsBySubtotalId as dbGetCropSubtotalsBySubtotalId,
  getSubtotalDefinitionsByCropRegionId as dbGetSubtotalDefsByCropRegionId,
} from "../lib/prisma/cropSubtotal"
import {
  createManySubtotals as dbCreateManySubtotals,
  createSubtotal as dbCreateSubtotal,
  deleteSubtotal as dbDeleteSubtotal,
  getSubtotalById as dbGetSubtotalById,
  getSubtotalsByGroupId as dbGetSubtotalsByGroupId,
  updateSubtotal as dbUpdateSubtotal,
} from "../lib/prisma/subtotal"
import { registerHandler, registerSafeHandler } from "./ipcHandlerUtils"

export function setupCropRegionHandlers(): void {
  // --- CropRegion Handlers ---
  registerHandler(
    "create-crop-region",
    async (data: Prisma.CropRegionUncheckedCreateInput) => {
      return await dbCreateCropRegion(data)
    }
  )

  registerHandler(
    "create-many-crop-regions",
    async (data: Prisma.CropRegionCreateManyInput[]) => {
      return await dbCreateManyCropRegions(data)
    }
  )

  registerHandler(
    "update-crop-region",
    async (id: string, data: Prisma.CropRegionUpdateInput) => {
      return await dbUpdateCropRegion(id, data)
    }
  )

  registerHandler(
    "update-crop-region-orders",
    async (updates: Array<{ id: string; orderIndex: number }>) => {
      return await dbUpdateCropRegionOrders(updates)
    }
  )

  registerHandler("delete-crop-region", async (id: string) => {
    return await dbDeleteCropRegion(id)
  })

  registerHandler("get-crop-regions-by-exam-id", async (examId: string) => {
    const result = await dbGetCropRegionsByExamId(examId)
    // questionScoresのDecimalをnumberに変換
    return result?.map(serializeCropRegion) || []
  })

  registerHandler(
    "get-question-answer-regions-by-exam-id",
    async (examId: string) => {
      const result = await dbGetQuestionAnswerRegionsByExamId(examId)
      // questionScoresのDecimalをnumberに変換
      return result?.map(serializeCropRegion) || []
    }
  )

  registerHandler("get-crop-region-by-id", async (id: string) => {
    const result = await dbGetCropRegionById(id)
    // questionScoresのDecimalをnumberに変換
    return result ? serializeCropRegion(result) : null
  })

  // --- Subtotal Handlers ---
  registerHandler(
    "create-subtotal",
    async (data: Prisma.SubtotalUncheckedCreateInput) => {
      return await dbCreateSubtotal(data)
    }
  )

  registerHandler(
    "create-many-subtotals",
    async (data: Prisma.SubtotalUncheckedCreateInput[]) => {
      return await dbCreateManySubtotals(data)
    }
  )

  registerHandler(
    "update-subtotal",
    async (id: string, data: Prisma.SubtotalUpdateInput) => {
      return await dbUpdateSubtotal(id, data)
    }
  )

  registerHandler("delete-subtotal", async (id: string) => {
    return await dbDeleteSubtotal(id)
  })

  registerHandler(
    "get-subtotals-by-group-id",
    async (subtotalGroupId: string) => {
      return await dbGetSubtotalsByGroupId(subtotalGroupId)
    }
  )

  registerHandler("get-subtotal-by-id", async (id: string) => {
    return await dbGetSubtotalById(id)
  })

  // --- CropSubtotal Handlers ---
  registerHandler(
    "create-crop-subtotal",
    async (data: Prisma.CropSubtotalUncheckedCreateInput) => {
      return await dbCreateCropSubtotal(data)
    }
  )

  registerHandler(
    "create-many-crop-subtotals",
    async (data: Prisma.CropSubtotalUncheckedCreateInput[]) => {
      return await dbCreateManyCropSubtotals(data)
    }
  )

  registerHandler("delete-crop-subtotal", async (id: string) => {
    return await dbDeleteCropSubtotal(id)
  })

  registerHandler(
    "delete-crop-subtotals-by-crop-region-id",
    async (cropRegionId: string) => {
      return await dbDeleteCropSubtotalsByCropRegionId(cropRegionId)
    }
  )

  registerHandler(
    "get-crop-subtotals-by-crop-region-id",
    async (cropRegionId: string) => {
      return await dbGetCropSubtotalsByCropRegionId(cropRegionId)
    }
  )

  // 互換性のあるレスポンス形式での取得（QuestionAssignmentMatrix専用）
  registerSafeHandler(
    "get-assignments-by-question-crop-region-id",
    async (cropRegionId: string) => {
      const assignments = await dbGetCropSubtotalsByCropRegionId(cropRegionId)
      return {
        success: true,
        assignments: assignments || [],
      }
    }
  )

  registerHandler(
    "get-crop-subtotals-by-subtotal-id",
    async (subtotalId: string) => {
      return await dbGetCropSubtotalsBySubtotalId(subtotalId)
    }
  )

  // 互換性のためのエイリアス
  registerHandler(
    "get-subtotal-definitions-by-crop-region-id",
    async (cropRegionId: string) => {
      return await dbGetSubtotalDefsByCropRegionId(cropRegionId)
    }
  )
}
