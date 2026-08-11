/**
 * NAS同期 Preload API
 */

import { ipcRenderer } from "electron"

import type { SyncAppConfig, SyncAppStatus } from "../lib/sync/types"
import { invoke } from "./invoke"

export function createSyncApi() {
  return {
    sync: {
      getConfig: () => invoke("sync:getConfig"),

      setConfig: (config: Partial<SyncAppConfig>) =>
        invoke("sync:setConfig", config),

      triggerNow: () => invoke("sync:triggerNow"),

      getStatus: () => invoke("sync:getStatus"),

      onStatusChanged: (
        callback: (status: SyncAppStatus) => void
      ): (() => void) => {
        const handler = (
          _event: Electron.IpcRendererEvent,
          status: SyncAppStatus
        ) => callback(status)
        ipcRenderer.on("sync:status-changed", handler)
        return () => ipcRenderer.removeListener("sync:status-changed", handler)
      },
    },
  }
}
