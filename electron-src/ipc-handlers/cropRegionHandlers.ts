import type { Prisma } from "@prisma/client"

import {
  createCropRegion,
  deleteCropRegion,
  getCropRegionsByExamId,
  getQuestionAnswerRegionsByExamId,
  updateCropRegion,
  updateCropRegionOrders,
} from "../lib/prisma/cropRegion"
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

  // 採点行は載っていないので、Decimal を倒す必要は無い（採点行は
  // get-question-scores-by-crop-region-id が設問ごとに返す）
  "get-crop-regions-by-exam-id": async (examId: string) =>
    getCropRegionsByExamId(examId),

  "get-question-answer-regions-by-exam-id": async (examId: string) =>
    getQuestionAnswerRegionsByExamId(examId),

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
