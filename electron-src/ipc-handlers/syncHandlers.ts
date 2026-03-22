/**
 * NAS同期 IPCハンドラー
 */

import { getNasSyncPath, loadSyncConfig } from "../lib/sync/syncConfig"
import {
  getSyncStatus,
  triggerSyncNow,
  updateSyncConfig,
} from "../lib/sync/syncService"
import type { SyncAppConfig } from "../lib/sync/types"
import { registerSafeHandler } from "./ipcHandlerUtils"

export function setupSyncHandlers(): void {
  registerSafeHandler("sync:getConfig", async () => {
    const config = loadSyncConfig()
    const syncPath = getNasSyncPath()
    return { success: true, config, syncPath }
  })

  registerSafeHandler(
    "sync:setConfig",
    async (partial: Partial<SyncAppConfig>) => {
      await updateSyncConfig(partial)
      return { success: true }
    }
  )

  registerSafeHandler("sync:triggerNow", async () => {
    const result = await triggerSyncNow()
    return { success: true, result }
  })

  registerSafeHandler("sync:getStatus", async () => {
    const status = getSyncStatus()
    return { success: true, status }
  })
}
