/**
 * NAS同期サービス
 *
 * sqlite-nas-syncのSyncInstanceをラップし、
 * アプリライフサイクルとIPC通信を管理する。
 *
 * **同期が動くのは共有モードで起動したときだけ**（issue #1322）。どの DB を使い、
 * どの共有フォルダへ写しを置くかは起動時に決まった根（`../storageRoots.ts`）から読み、
 * 動いている間は変えない。モードやプロファイルの切り替えは、設定を書いて再起動で
 * 効かせる（`storageModeService.ts`）。ローカルモードへ切り替えても、何も書き戻さない。
 *
 * 削除の伝搬はライブラリの `_tombstone`（削除の版）に一本化している。
 * 時刻を見ずに id を消し続けるアプリ側の削除記録は持たない（issue #918）。
 *
 * v0.20.0 から、ライブラリはアプリの表を**行の版から作り直す**。別id・同一ユニークキーで
 * かぶった行は1つへ畳まれず、弱い方が隠れるだけになった（事実は残り、重なりが解ければ戻る。
 * ただし v0.21.0 から、表示している方を削除すると隠れている方にも削除が書かれる）。
 * 旧方式のローカルDB（`_changelog` / `_tombstone` / `_id_merge` を持つもの）は、
 * `setupSync` の最初の1回でライブラリが移行するので、アプリ側の移行処理は要らない。
 *
 * **アプリの表を書く接続はすべて `PRAGMA recursive_triggers = ON` で開くこと**
 * （`../prisma/sqliteConnection.ts`）。ライブラリの接続はライブラリが自分で立てる。
 */

import type { SyncInstance, SyncResult } from "sqlite-nas-sync"

import { getStorageRoots } from "../storageRoots"
import {
  getSharedFolderSyncDirectory,
  readSharedFolderId,
} from "./sharedFolder"
import {
  recordFoldAuditLogs,
  recordParentDeletedAuditLogs,
} from "./syncAuditLog"
import {
  broadcastParentDeleted,
  broadcastRecordFolds,
  broadcastSyncStatus,
} from "./syncBroadcast"
import { loadSyncConfig, saveSyncConfig } from "./syncConfig"
import { createAppSyncInstance } from "./syncInstanceFactory"
import type {
  SyncAppConfig,
  SyncAppStatus,
  SyncParentDeletedReport,
  SyncRecordFoldReport,
  VersionMismatchRemote,
} from "./types"

/**
 * SyncResultからバージョン不一致リモートの一覧を抽出する。
 *
 * 両方の版は、こちらが `setupSync` に渡したアプリの版（マイグレーション名）そのもので
 * 届く。v0.20.0 はライブラリの内部の印（`;sns-format=rows1`）が付いたまま返していたが、
 * v0.21.0 で外された。マイグレーション名はタイムスタンプ接頭辞なので辞書順で比べられる。
 *
 * ここに出るのは**アプリの版が違う相手だけ**である。ライブラリの内部形式（`sns-format`）が
 * 違う相手も見送られるが、v0.20.0 と v0.21.0 の形式はどちらも `rows1` なので、
 * アプリの版が同じならライブラリの版が違っても見送られない（＝混ざって同期する）。
 * ライブラリを上げる版は全PCへ同時に配ること。
 */
function extractVersionMismatches(result: SyncResult): VersionMismatchRemote[] {
  return result.skippedRemotes.map((skippedRemote) => ({
    clientId: skippedRemote.clientId,
    remoteVersion: skippedRemote.remoteVersion,
    remoteIsNewer:
      skippedRemote.remoteVersion !== null &&
      skippedRemote.remoteVersion > skippedRemote.localVersion,
  }))
}

let syncInstance: SyncInstance | null = null

/** 定期実行のタイマー（ライブラリの `start()` は使わない。下の `runGuardedSync` 参照） */
let intervalHandle: ReturnType<typeof setInterval> | null = null

let currentStatus: SyncAppStatus = {
  state: "disabled",
  lastSyncTime: null,
  lastError: null,
  syncCount: 0,
  versionMismatches: [],
  lastWarnings: [],
}

function updateStatus(partial: Partial<SyncAppStatus>): void {
  currentStatus = { ...currentStatus, ...partial }
  broadcastSyncStatus(currentStatus)
}

/**
 * アプリ起動時の初期化。共有モードで起動したときだけ同期を始める。
 */
export async function initializeSync(): Promise<void> {
  if (getStorageRoots().mode !== "shared") {
    updateStatus({ state: "disabled" })
    return
  }

  try {
    await startSync(loadSyncConfig())
  } catch (error) {
    console.error("Failed to initialize sync:", error)
    updateStatus({
      state: "error",
      lastError: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * 共有フォルダが、登録したときの共有フォルダのままかを確かめる。
 *
 * 同期の写しはパスへ置くので、そのパスが別のフォルダになっていたら（ドライブの
 * 割り当てが変わった・別の共有フォルダが同じ場所に来た）、そこへ写しを置いては
 * ならない。識別ファイルの id で確かめる。
 */
function checkSharedFolderIdentity(): string | null {
  const { sharedFolder } = getStorageRoots()
  if (sharedFolder === null) return "共有モードで起動していません"
  try {
    if (
      readSharedFolderId(sharedFolder.sharedFolderPath) ===
      sharedFolder.sharedFolderId
    ) {
      return null
    }
  } catch {
    // 下の文面で知らせる
  }
  return `共有フォルダ（${sharedFolder.sharedFolderPath}）に接続できないか、別の共有フォルダになっています`
}

/**
 * 共有フォルダを確かめてから1回同期する。
 *
 * ライブラリの `start()` は確かめずに同期する（写しの置き場が無ければ作りさえする）ので、
 * 定期実行はこちらのタイマーで回し、毎回ここを通す。
 */
async function runGuardedSync(instance: SyncInstance): Promise<SyncResult> {
  const problem = checkSharedFolderIdentity()
  if (problem !== null) {
    updateStatus({ state: "error", lastError: problem })
    throw new Error(problem)
  }
  return instance.syncNow()
}

/** syncを開始する（共有モードで起動しているときだけ） */
export async function startSync(config: SyncAppConfig): Promise<void> {
  await stopSync()

  const roots = getStorageRoots()
  if (roots.mode !== "shared" || roots.sharedFolder === null) {
    throw new Error("同期は共有モードでだけ動きます")
  }

  const instance = await createAppSyncInstance({
    dbPath: roots.databasePath,
    nasPath: getSharedFolderSyncDirectory(roots.sharedFolder.sharedFolderPath),
    clientId: config.clientId,
    intervalMs: config.intervalMs,
    changelogRetentionDays: config.changelogRetentionDays,
    onAfterSync: (_localDb, result) => {
      updateStatus({
        state: "idle",
        lastSyncTime: new Date().toISOString(),
        lastError: null,
        syncCount: currentStatus.syncCount + 1,
        versionMismatches: extractVersionMismatches(result),
        lastWarnings: result.warnings,
      })

      // 隠れた行は画面から黙って1つ消えたように見え、戻った行は消したはずのものが
      // 現れたように見える。どちらも起きた瞬間に伝える。
      const foldReport: SyncRecordFoldReport = {
        folds: result.folds,
        restores: result.restores,
      }
      broadcastRecordFolds(foldReport)
      // 記録はベストエフォート（`recordAuditLog` は失敗を握りつぶす）。同期の
      // コールバックは同期関数なので、書き込みの完了は待たずに切り離す。
      void recordFoldAuditLogs(foldReport)

      // 親を他のPCで消されて表から外れた行も、画面からは黙って消えたように見える。
      const parentDeletedReport: SyncParentDeletedReport = {
        parentDeleted: result.parentDeleted,
        parentReturned: result.parentReturned,
      }
      broadcastParentDeleted(parentDeletedReport)
      void recordParentDeletedAuditLogs(parentDeletedReport)
    },
  })
  syncInstance = instance

  instance.on("sync:start", () => {
    updateStatus({ state: "syncing" })
  })

  instance.on("sync:error", (error) => {
    updateStatus({
      state: "error",
      lastError: error instanceof Error ? error.message : String(error),
    })
  })

  intervalHandle = setInterval(() => {
    runGuardedSync(instance).catch(() => {
      // 失敗は状態（sync:error・runGuardedSync）で知らせてある
    })
  }, config.intervalMs)
  updateStatus({ state: "idle", lastError: null })
}

/** syncを停止する */
export async function stopSync(): Promise<void> {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
  if (syncInstance) {
    const closing = syncInstance
    syncInstance = null
    // 実行中の同期が終わるのを待ってから、`setupSync` が開いた接続を閉じる
    // （アプリの終了時もここを通る。`index.ts` の before-quit）
    await closing.close()
  }
  // 止めた時点の注意は、次に始めたときには古い。空にしておけば、次に出たときに
  // renderer は新しく出たものとして知らせる
  updateStatus({ state: "disabled", lastWarnings: [] })
}

/** 手動sync実行 */
export async function triggerSyncNow(): Promise<SyncResult> {
  if (!syncInstance) {
    throw new Error(
      "同期が動いていません（共有モードで起動したときだけ同期します）"
    )
  }
  return runGuardedSync(syncInstance)
}

/** 現在のステータスを取得 */
export function getSyncStatus(): SyncAppStatus {
  return { ...currentStatus }
}

/**
 * 同期の間隔・保持期間を変える。共有モードで動いていれば、新しい値で同期を始め直す。
 *
 * モードとプロファイルはここでは変えない（`storageModeService.ts`。再起動で効かせる）。
 */
export async function updateSyncTiming(
  partial: Partial<Pick<SyncAppConfig, "intervalMs" | "changelogRetentionDays">>
): Promise<void> {
  const updated = { ...loadSyncConfig(), ...partial }
  saveSyncConfig(updated)
  if (syncInstance) {
    await startSync(updated)
  }
}
