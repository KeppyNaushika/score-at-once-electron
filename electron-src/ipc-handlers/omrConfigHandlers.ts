/**
 * CropRegionOmrConfig IPC ハンドラー
 */

import {
  deleteOmrConfig,
  getOmrConfigsByExamId,
  upsertOmrConfig,
  type UpsertOmrConfigData,
} from "../lib/prisma/cropRegionOmrConfig"
import { registerSafeHandler } from "./ipcHandlerUtils"

/** OMR設定（CropRegionOmrConfig）のCRUD用IPCチャンネルを登録する */
export function setupOmrConfigHandlers(): void {
  registerSafeHandler(
    "omr-config:upsert",
    async (data: UpsertOmrConfigData) => {
      const config = await upsertOmrConfig(data)
      return { success: true, config }
    },
    "OMR設定の保存に失敗しました"
  )

  registerSafeHandler(
    "omr-config:delete",
    async (cropRegionId: string) => {
      await deleteOmrConfig(cropRegionId)
      return { success: true }
    },
    "OMR設定の削除に失敗しました"
  )

  registerSafeHandler(
    "omr-config:get-by-exam",
    async (examId: string) => {
      const configs = await getOmrConfigsByExamId(examId)
      return { success: true, configs }
    },
    "OMR設定の取得に失敗しました"
  )
}
