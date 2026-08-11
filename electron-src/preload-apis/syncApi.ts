/**
 * NAS同期 Preload API
 */

import { ipcRenderer } from "electron"

import type { SyncAppStatus } from "../lib/sync/types"
import { bind } from "./invoke"

export function createSyncApi() {
  return {
    sync: {
      getConfig: bind("sync:getConfig"),

      setConfig: bind("sync:setConfig"),

      triggerNow: bind("sync:triggerNow"),

      getStatus: bind("sync:getStatus"),

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
