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
import { registerHandler } from "./ipcHandlerUtils"

export function setupSyncHandlers(): void {
  registerHandler("sync:getConfig", async () => ({
    config: loadSyncConfig(),
    syncPath: getNasSyncPath(),
  }))

  registerHandler("sync:setConfig", async (partial: Partial<SyncAppConfig>) => {
    await updateSyncConfig(partial)
  })

  registerHandler("sync:triggerNow", () => triggerSyncNow())

  registerHandler("sync:getStatus", async () => getSyncStatus())
}
