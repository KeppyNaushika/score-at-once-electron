/**
 * CropRegionOmrConfig IPC ハンドラー
 */

import {
  deleteOmrConfig,
  getOmrConfigsByExamId,
  upsertOmrConfig,
  type UpsertOmrConfigData,
} from "../lib/prisma/cropRegionOmrConfig"
import { type HandlerMap } from "./ipcHandlerUtils"

/** OMR設定（CropRegionOmrConfig）のCRUD用IPCチャンネルを登録する */
export const omrConfigHandlers = {
  "omr-config:upsert": (data: UpsertOmrConfigData) => upsertOmrConfig(data),

  "omr-config:delete": async (cropRegionId: string) => {
    await deleteOmrConfig(cropRegionId)
  },

  "omr-config:get-by-exam": (examId: string) => getOmrConfigsByExamId(examId),
} satisfies HandlerMap
