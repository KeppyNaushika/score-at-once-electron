/**
 * CropRegionOmrConfig IPC ハンドラー
 */

import {
  deleteOmrConfig,
  getOmrConfigsByExamId,
  upsertOmrConfig,
  type UpsertOmrConfigData,
} from "../lib/prisma/cropRegionOmrConfig"
import { registerHandler } from "./ipcHandlerUtils"

/** OMR設定（CropRegionOmrConfig）のCRUD用IPCチャンネルを登録する */
export function setupOmrConfigHandlers(): void {
  registerHandler("omr-config:upsert", (data: UpsertOmrConfigData) =>
    upsertOmrConfig(data)
  )

  registerHandler("omr-config:delete", async (cropRegionId: string) => {
    await deleteOmrConfig(cropRegionId)
  })

  registerHandler("omr-config:get-by-exam", (examId: string) =>
    getOmrConfigsByExamId(examId)
  )
}
