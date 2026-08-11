import type { Prisma } from "@prisma/client"

import {
  createCropRegion,
  deleteCropRegion,
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
  createManyCropSubtotals,
  deleteCropSubtotalsByCropRegionId,
  getCropSubtotalsByCropRegionId,
} from "../lib/prisma/cropSubtotal"
import { type HandlerMap } from "./ipcHandlerUtils"

/** 採点領域（CropRegion）・領域小計点紐付け（CropSubtotal）のCRUD用IPCチャンネルを登録する */
export const cropRegionHandlers = {
  // --- CropRegion Handlers ---
  "create-crop-region": async (data: Prisma.CropRegionUncheckedCreateInput) => {
    return await createCropRegion(data)
  },

  "update-crop-region": async (
    id: string,
    data: Prisma.CropRegionUpdateInput
  ) => {
    return await updateCropRegion(id, data)
  },

  "update-crop-region-orders": async (
    updates: Array<{ id: string; orderIndex: number }>
  ) => {
    return await updateCropRegionOrders(updates)
  },

  "delete-crop-region": async (id: string) => {
    return await deleteCropRegion(id)
  },

  "get-crop-regions-by-exam-id": async (examId: string) => {
    const result = await getCropRegionsByExamId(examId)
    // questionScoresのDecimalをnumberに変換
    return result?.map(serializeCropRegion) || []
  },

  "get-question-answer-regions-by-exam-id": async (examId: string) => {
    const result = await getQuestionAnswerRegionsByExamId(examId)
    // questionScoresのDecimalをnumberに変換
    return result?.map(serializeCropRegion) || []
  },

  // --- CropSubtotal Handlers ---
  "create-many-crop-subtotals": async (
    data: Prisma.CropSubtotalUncheckedCreateInput[]
  ) => {
    return await createManyCropSubtotals(data)
  },

  "delete-crop-subtotals-by-crop-region-id": async (cropRegionId: string) => {
    return await deleteCropSubtotalsByCropRegionId(cropRegionId)
  },

  "get-crop-subtotals-by-crop-region-id": async (cropRegionId: string) => {
    return await getCropSubtotalsByCropRegionId(cropRegionId)
  },
} satisfies HandlerMap
