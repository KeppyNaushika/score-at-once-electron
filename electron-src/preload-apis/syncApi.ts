/**
 * NAS同期 Preload API
 */

import { ipcRenderer } from "electron"

import type {
  SyncAppStatus,
  SyncParentDeletedReport,
  SyncRecordFoldReport,
} from "../lib/sync/types"
import { bind } from "./invoke"

/**
 * main が押し出してくるチャンネルを購読する。外すのは戻り値を呼ぶ。
 *
 * 押し出しはどれも「出来事を1つ受け取って callback へ渡す」だけなので、張り方と
 * 外し方をここ1か所に置く。
 */
function subscribe<Payload>(
  channel: string,
  callback: (payload: Payload) => void
): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: Payload) =>
    callback(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

export function createSyncApi() {
  return {
    sync: {
      getConfig: bind("sync:getConfig"),

      setConfig: bind("sync:setConfig"),

      triggerNow: bind("sync:triggerNow"),

      getStatus: bind("sync:getStatus"),

      /**
       * 同期の状態が変わったら呼ばれる購読を張る。直近の同期が出した注意の全文
       * （`lastWarnings`）もここに載る。
       */
      onStatusChanged: (callback: (status: SyncAppStatus) => void) =>
        subscribe("sync:status-changed", callback),

      /**
       * 別id・同一ユニークキーでかぶった行の片方が隠れた、または隠れていた行が
       * 表示に戻ったら呼ばれる購読を張る。
       */
      onRecordFoldsChanged: (
        callback: (report: SyncRecordFoldReport) => void
      ) => subscribe("sync:record-folds-changed", callback),

      /**
       * 親の行が他のPCで削除されたために表から外れた行、親が作り直されて戻った行が
       * 出たら呼ばれる購読を張る。
       */
      onParentDeletedChanged: (
        callback: (report: SyncParentDeletedReport) => void
      ) => subscribe("sync:parent-deleted-changed", callback),
    },
  }
}
