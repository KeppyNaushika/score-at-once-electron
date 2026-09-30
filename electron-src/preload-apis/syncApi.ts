/**
 * NAS同期 Preload API
 */

import { ipcRenderer } from "electron"

import type {
  SyncAppStatus,
  SyncParentDeletedReport,
  SyncRecordFoldReport,
  SyncWarningReport,
} from "../lib/sync/types"
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
       * 別id・同一ユニークキーでかぶった行の片方が隠れた、または隠れていた行が
       * 表示に戻ったら呼ばれる購読を張る。外すのは戻り値を呼ぶ。
       */
      onRecordFoldsChanged: (
        callback: (report: SyncRecordFoldReport) => void
      ): (() => void) => {
        const handler = (
          _event: Electron.IpcRendererEvent,
          report: SyncRecordFoldReport
        ) => callback(report)
        ipcRenderer.on("sync:record-folds-changed", handler)
        return () =>
          ipcRenderer.removeListener("sync:record-folds-changed", handler)
      },

      /**
       * 親の行が他のPCで削除されたために表から外れた行、親が作り直されて戻った行が
       * 出たら呼ばれる購読を張る。外すのは戻り値を呼ぶ。
       */
      onParentDeletedChanged: (
        callback: (report: SyncParentDeletedReport) => void
      ): (() => void) => {
        const handler = (
          _event: Electron.IpcRendererEvent,
          report: SyncParentDeletedReport
        ) => callback(report)
        ipcRenderer.on("sync:parent-deleted-changed", handler)
        return () =>
          ipcRenderer.removeListener("sync:parent-deleted-changed", handler)
      },

      /**
       * 同期が**新しく出した**注意書きが届いたら呼ばれる購読を張る。外すのは戻り値を呼ぶ。
       *
       * 直近1回ぶんの全文は `getStatus()` の `lastWarnings` にあり、こちらは気づかせる
       * ためだけのもの。取りこぼしても読む場所は残る。
       */
      onWarningsChanged: (
        callback: (report: SyncWarningReport) => void
      ): (() => void) => {
        const handler = (
          _event: Electron.IpcRendererEvent,
          report: SyncWarningReport
        ) => callback(report)
        ipcRenderer.on("sync:warnings-changed", handler)
        return () =>
          ipcRenderer.removeListener("sync:warnings-changed", handler)
      },
    },
  }
}
