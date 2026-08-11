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
import { type HandlerMap } from "./ipcHandlerUtils"

export const syncHandlers = {
  "sync:getConfig": async () => ({
    config: loadSyncConfig(),
    syncPath: getNasSyncPath(),
  }),

  "sync:setConfig": async (partial: Partial<SyncAppConfig>) => {
    await updateSyncConfig(partial)
  },

  "sync:triggerNow": () => triggerSyncNow(),

  "sync:getStatus": async () => getSyncStatus(),
} satisfies HandlerMap
