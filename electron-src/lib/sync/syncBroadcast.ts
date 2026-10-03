/**
 * 同期の出来事を renderer へ押し出す。
 *
 * どれも開いている全部の窓へ同じものを送るだけで、**中身は加工しない**（言い換え・
 * 数え上げ・「新しく出たか」の見分けは renderer 側で行う）。
 */

import { BrowserWindow } from "electron"

import type {
  SyncAppStatus,
  SyncParentDeletedReport,
  SyncRecordFoldReport,
} from "./types"

/** 開いている全部の窓へ送る。閉じかけの窓に送って失敗しても無視する */
function sendToAllWindows(channel: string, payload: unknown): void {
  for (const browserWindow of BrowserWindow.getAllWindows()) {
    try {
      browserWindow.webContents.send(channel, payload)
    } catch {
      // ウィンドウが既に閉じられている場合は無視
    }
  }
}

/**
 * 同期の状態を押し出す。直近の同期が出した注意の全文（`lastWarnings`）もここに載る。
 *
 * ライブラリの `SyncResult.warnings` は「アプリケーションの利用者に見える場所へ出す」
 * ものなので、消えない一覧（設定画面）とトースト（新しく出たぶんだけ）の両方の元になる。
 */
export function broadcastSyncStatus(status: SyncAppStatus): void {
  sendToAllWindows("sync:status-changed", status)
}

/**
 * かぶった行の見え方が変わった（隠れた・表示に戻った）ことを押し出す。
 *
 * **既読は持たない。** 同期はアプリが動いている間しか走らないので、変わった瞬間には
 * 必ず窓が開いている。読んだかどうかを覚えると、その状態がまた新しい保存先になる。
 * あとから見返す口は監査ログ（`sync.duplicate.hide` / `sync.duplicate.restore`）に寄せる。
 */
export function broadcastRecordFolds(report: SyncRecordFoldReport): void {
  if (report.folds.length === 0 && report.restores.length === 0) return
  sendToAllWindows("sync:record-folds-changed", report)
}

/**
 * 親が他のPCで削除されたために表から外れた行・親が作り直されて戻った行を押し出す。
 *
 * `broadcastRecordFolds` と同じく**既読は持たない**が、こちらは取りこぼしても事実は
 * 失われない（ライブラリの内部表 `_sns_unplaceable` に残っていて、外れたままの行は
 * 次の回でもう一度は出ないだけ）。
 */
export function broadcastParentDeleted(report: SyncParentDeletedReport): void {
  if (report.parentDeleted.length === 0 && report.parentReturned.length === 0)
    return
  sendToAllWindows("sync:parent-deleted-changed", report)
}
