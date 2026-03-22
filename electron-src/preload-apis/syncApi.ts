/**
 * NAS同期 Preload API
 */

import { ipcRenderer } from "electron"

import type { SyncAppConfig, SyncAppStatus } from "../lib/sync/types"

export function createSyncApi() {
  return {
    sync: {
      getConfig: (): Promise<{
        success: boolean
        config?: SyncAppConfig
        syncPath?: string
        error?: string
      }> => ipcRenderer.invoke("sync:getConfig"),

      setConfig: (
        config: Partial<SyncAppConfig>
      ): Promise<{ success: boolean; error?: string }> =>
        ipcRenderer.invoke("sync:setConfig", config),

      triggerNow: (): Promise<{ success: boolean; error?: string }> =>
        ipcRenderer.invoke("sync:triggerNow"),

      getStatus: (): Promise<{
        success: boolean
        status?: SyncAppStatus
        error?: string
      }> => ipcRenderer.invoke("sync:getStatus"),

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
