import { Prisma } from "@prisma/client"

import {
  createCropRegion,
  createManyCropRegions,
  deleteCropRegion,
  getCropRegionById,
  getCropRegionsByExamId,
  getQuestionAnswerRegionsByExamId,
  updateCropRegion,
  updateCropRegionOrders,
} from "../lib/prisma/cropRegion"

/**
 * QuestionScoreをIPC用にシリアライズ（DecimalをnumberにDateはそのまま）
 */
function serializeQuestionScore(score: {
  id: string
  cropRegionId: string
  examStudentId: string
  partialScore: { toNumber(): number } | null
  status: string
  userId: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: score.id,
    cropRegionId: score.cropRegionId,
    examStudentId: score.examStudentId,
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
      examStudentId: string
      partialScore: { toNumber(): number } | null
      status: string
      userId: string
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
  createCropSubtotal,
  createManyCropSubtotals,
  deleteCropSubtotal,
  deleteCropSubtotalsByCropRegionId,
  getCropSubtotalsByCropRegionId,
  getCropSubtotalsBySubtotalId,
  getSubtotalDefinitionsByCropRegionId,
} from "../lib/prisma/cropSubtotal"
import {
  createManySubtotals,
  createSubtotal,
  deleteSubtotal,
  getSubtotalById,
  getSubtotalsByGroupId,
  updateSubtotal,
} from "../lib/prisma/subtotal"
import { registerHandler, registerSafeHandler } from "./ipcHandlerUtils"

/** 採点領域（CropRegion）・小計点（Subtotal）・領域小計点紐付け（CropSubtotal）のCRUD用IPCチャンネルを登録する */
export function setupCropRegionHandlers(): void {
  // --- CropRegion Handlers ---
  registerHandler(
    "create-crop-region",
    async (data: Prisma.CropRegionUncheckedCreateInput) => {
      return await createCropRegion(data)
    }
  )

  registerHandler(
    "create-many-crop-regions",
    async (data: Prisma.CropRegionCreateManyInput[]) => {
      return await createManyCropRegions(data)
    }
  )

  registerHandler(
    "update-crop-region",
    async (id: string, data: Prisma.CropRegionUpdateInput) => {
      return await updateCropRegion(id, data)
    }
  )

  registerHandler(
    "update-crop-region-orders",
    async (updates: Array<{ id: string; orderIndex: number }>) => {
      return await updateCropRegionOrders(updates)
    }
  )

  registerHandler("delete-crop-region", async (id: string) => {
    return await deleteCropRegion(id)
  })

  registerHandler("get-crop-regions-by-exam-id", async (examId: string) => {
    const result = await getCropRegionsByExamId(examId)
    // questionScoresのDecimalをnumberに変換
    return result?.map(serializeCropRegion) || []
  })

  registerHandler(
    "get-question-answer-regions-by-exam-id",
    async (examId: string) => {
      const result = await getQuestionAnswerRegionsByExamId(examId)
      // questionScoresのDecimalをnumberに変換
      return result?.map(serializeCropRegion) || []
    }
  )

  registerHandler("get-crop-region-by-id", async (id: string) => {
    const result = await getCropRegionById(id)
    // questionScoresのDecimalをnumberに変換
    return result ? serializeCropRegion(result) : null
  })

  // --- Subtotal Handlers ---
  registerHandler(
    "create-subtotal",
    async (data: Prisma.SubtotalUncheckedCreateInput) => {
      return await createSubtotal(data)
    }
  )

  registerHandler(
    "create-many-subtotals",
    async (data: Prisma.SubtotalUncheckedCreateInput[]) => {
      return await createManySubtotals(data)
    }
  )

  registerHandler(
    "update-subtotal",
    async (id: string, data: Prisma.SubtotalUpdateInput) => {
      return await updateSubtotal(id, data)
    }
  )

  registerHandler("delete-subtotal", async (id: string) => {
    return await deleteSubtotal(id)
  })

  registerHandler(
    "get-subtotals-by-group-id",
    async (subtotalGroupId: string) => {
      return await getSubtotalsByGroupId(subtotalGroupId)
    }
  )

  registerHandler("get-subtotal-by-id", async (id: string) => {
    return await getSubtotalById(id)
  })

  // --- CropSubtotal Handlers ---
  registerHandler(
    "create-crop-subtotal",
    async (data: Prisma.CropSubtotalUncheckedCreateInput) => {
      return await createCropSubtotal(data)
    }
  )

  registerHandler(
    "create-many-crop-subtotals",
    async (data: Prisma.CropSubtotalUncheckedCreateInput[]) => {
      return await createManyCropSubtotals(data)
    }
  )

  registerHandler("delete-crop-subtotal", async (id: string) => {
    return await deleteCropSubtotal(id)
  })

  registerHandler(
    "delete-crop-subtotals-by-crop-region-id",
    async (cropRegionId: string) => {
      return await deleteCropSubtotalsByCropRegionId(cropRegionId)
    }
  )

  registerHandler(
    "get-crop-subtotals-by-crop-region-id",
    async (cropRegionId: string) => {
      return await getCropSubtotalsByCropRegionId(cropRegionId)
    }
  )

  // 互換性のあるレスポンス形式での取得（QuestionAssignmentMatrix専用）
  registerSafeHandler(
    "get-assignments-by-question-crop-region-id",
    async (cropRegionId: string) => {
      const assignments = await getCropSubtotalsByCropRegionId(cropRegionId)
      return {
        success: true,
        assignments: assignments || [],
      }
    }
  )

  registerHandler(
    "get-crop-subtotals-by-subtotal-id",
    async (subtotalId: string) => {
      return await getCropSubtotalsBySubtotalId(subtotalId)
    }
  )

  // 互換性のためのエイリアス
  registerHandler(
    "get-subtotal-definitions-by-crop-region-id",
    async (cropRegionId: string) => {
      return await getSubtotalDefinitionsByCropRegionId(cropRegionId)
    }
  )
}
