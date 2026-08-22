/**
 * NAS同期 Preload API
 */

import { ipcRenderer } from "electron"

import type { SyncAppStatus, SyncRecordFold } from "../lib/sync/types"
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

      /**
       * 別id・同一ユニークキーの行が1つへ畳まれたら呼ばれる購読を張る。
       * 外すのは戻り値を呼ぶ。
       */
      onRecordsFolded: (
        callback: (folds: SyncRecordFold[]) => void
      ): (() => void) => {
        const handler = (
          _event: Electron.IpcRendererEvent,
          folds: SyncRecordFold[]
        ) => callback(folds)
        ipcRenderer.on("sync:records-folded", handler)
        return () => ipcRenderer.removeListener("sync:records-folded", handler)
      },
    },
  }
}
