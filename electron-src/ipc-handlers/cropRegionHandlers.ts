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
 *
 * **列を手写ししているので、`QuestionScore` に列を足したらここにも足すこと。**
 * 引数の型が受け入れる形は「少なくともこれらを持つ行」なので、足し忘れても
 * typecheck は通り、その列だけが renderer へ届かない。
 */
function serializeQuestionScore(score: {
  id: string
  cropRegionId: string
  examStudentId: string
  partialScore: { toNumber(): number } | null
  status: string
  comment: string
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
    comment: score.comment,
    userId: score.userId,
    createdAt: score.createdAt,
    updatedAt: score.updatedAt,
  }
}

/**
 * CropRegionをIPC用にシリアライズ（questionScoresのDecimalを変換）
 *
 * 受け入れる採点行の形は `serializeQuestionScore` の引数そのもの。手写しで
 * 二重に並べていた頃は、片方にだけ列を足すと引数の型が食い違って落ちた
 * （列を足す作業の途中で、無関係に見えるここが赤くなる）。
 */
function serializeCropRegion<
  T extends {
    questionScores?: Parameters<typeof serializeQuestionScore>[0][]
  },
>(region: T) {
  return {
    ...region,
    questionScores: region.questionScores?.map(serializeQuestionScore) || [],
  }
}

import {
  createCropSubtotal,
  deleteCropSubtotal,
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
  "create-crop-subtotal": async (
    data: Prisma.CropSubtotalUncheckedCreateInput
  ) => {
    return await createCropSubtotal(data)
  },

  "delete-crop-subtotal": async (cropSubtotalId: string) => {
    return await deleteCropSubtotal(cropSubtotalId)
  },
} satisfies HandlerMap
