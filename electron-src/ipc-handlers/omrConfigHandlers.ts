/**
 * CropRegionOmrConfig IPC ハンドラー
 */

import { ipcMain } from "electron"

import {
  deleteOmrConfig,
  getOmrConfigsByExamId,
  upsertOmrConfig,
  type UpsertOmrConfigData,
} from "../lib/prisma/cropRegionOmrConfig"

export function setupOmrConfigHandlers(): void {
  ipcMain.handle(
    "omr-config:upsert",
    async (_event, data: UpsertOmrConfigData) => {
      try {
        const config = await upsertOmrConfig(data)
        return { success: true, config }
      } catch (error) {
        console.error("Error upserting OMR config:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "OMR設定の保存に失敗しました",
        }
      }
    }
  )

  ipcMain.handle("omr-config:delete", async (_event, cropRegionId: string) => {
    try {
      await deleteOmrConfig(cropRegionId)
      return { success: true }
    } catch (error) {
      console.error("Error deleting OMR config:", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "OMR設定の削除に失敗しました",
      }
    }
  })

  ipcMain.handle("omr-config:get-by-exam", async (_event, examId: string) => {
    try {
      const configs = await getOmrConfigsByExamId(examId)
      return { success: true, configs }
    } catch (error) {
      console.error("Error getting OMR configs:", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "OMR設定の取得に失敗しました",
      }
    }
  })
}
