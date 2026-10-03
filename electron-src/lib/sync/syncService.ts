/**
 * NAS同期サービス
 *
 * sqlite-nas-syncのSyncInstanceをラップし、
 * アプリライフサイクルとIPC通信を管理する。
 *
 * sync有効時はローカルDBを使用し、NAS経由で他PCと同期する。
 * sync無効時はNAS上のDBを直接使用する（従来動作）。
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

import {
  ensureLocalDb,
  removeLocalDbDirectory,
  writeBackLocalDb,
} from "./localDb"
import { getSchemaVersion } from "./schemaVersion"
import {
  recordFoldAuditLogs,
  recordParentDeletedAuditLogs,
} from "./syncAuditLog"
import {
  broadcastParentDeleted,
  broadcastRecordFolds,
  broadcastSyncStatus,
} from "./syncBroadcast"
import {
  ensureClientId,
  ensureSyncDirectory,
  getLocalDbPath,
  getNasSyncPath,
  loadSyncConfig,
  saveSyncConfig,
} from "./syncConfig"
import { SYNC_EXCLUDE_TABLES, SYNC_TABLE_OPTIONS } from "./syncTableConfig"
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
 * アプリ起動時の初期化。設定が有効ならsyncを開始する。
 *
 * **起動時にローカルDBの控えを消してはならない。** 消し残りを掃除したくなるが、
 * `config.enabled === false` は「書き戻しが終わった」証拠にならない。
 * `loadSyncConfig()` は `sync-config.json` が無いときも、JSON として壊れているときも、
 * 例外を握りつぶして既定値（`enabled: false`）を返す。設定ファイルが消える・壊れるだけで
 * 起動時の掃除が走り、書き戻しを一度もしていないローカルDBを消すことになる。
 * 同期を切れなくなった利用者が設定ファイルを手で書き換えて回避する経路も同じで、
 * そのローカルDBは正本である。どちらも「ゴミ」ではなく唯一のデータなので、消さない。
 *
 * 消し残りはディスクを使うだけで害が無く、`updateSyncConfig` の正常な経路では既に
 * 消えている。積極的な証拠（「まだ消していない」という印）を設定ファイルへ持たせる案も
 * あるが、その印もまた設定ファイルが壊れれば失われ、守られる利益が消し残りのディスク
 * だけなので、印は持たずに掃除そのものを行わない。
 */
export async function initializeSync(): Promise<void> {
  let config = loadSyncConfig()
  config = ensureClientId(config)

  if (!config.enabled) {
    updateStatus({ state: "disabled" })
    return
  }

  try {
    await startSync(config)
  } catch (error) {
    console.error("Failed to initialize sync:", error)
    updateStatus({
      state: "error",
      lastError: error instanceof Error ? error.message : String(error),
    })
  }
}

/** syncを開始する */
export async function startSync(config: SyncAppConfig): Promise<void> {
  await stopSync()

  // ローカルDBを準備
  await ensureLocalDb()

  const dbPath = getLocalDbPath()
  const nasPath = getNasSyncPath()
  ensureSyncDirectory()

  const { setupSync } = await import("sqlite-nas-sync")

  syncInstance = setupSync({
    dbPath,
    nasPath,
    clientId: config.clientId,
    excludeTables: SYNC_EXCLUDE_TABLES,
    tableOptions: SYNC_TABLE_OPTIONS,
    intervalMs: config.intervalMs,
    changelogRetentionDays: config.changelogRetentionDays,
    schemaVersion: getSchemaVersion(),
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

  syncInstance.on("sync:start", () => {
    updateStatus({ state: "syncing" })
  })

  syncInstance.on("sync:error", (error) => {
    updateStatus({
      state: "error",
      lastError: error instanceof Error ? error.message : String(error),
    })
  })

  syncInstance.start()
  updateStatus({ state: "idle", lastError: null })
}

/** syncを停止する */
export async function stopSync(): Promise<void> {
  if (syncInstance) {
    syncInstance.stop()
    syncInstance = null
  }
  // 止めた時点の注意は、次に始めたときには古い。空にしておけば、次に出たときに
  // renderer は新しく出たものとして知らせる
  updateStatus({ state: "disabled", lastWarnings: [] })
}

/** 手動sync実行 */
export async function triggerSyncNow(): Promise<SyncResult> {
  if (!syncInstance) {
    throw new Error("同期が有効になっていません")
  }
  return syncInstance.syncNow()
}

/** 現在のステータスを取得 */
export function getSyncStatus(): SyncAppStatus {
  return { ...currentStatus }
}

/** 設定を更新してsyncを再起動 */
export async function updateSyncConfig(
  partial: Partial<SyncAppConfig>
): Promise<void> {
  const current = loadSyncConfig()
  const updated = { ...current, ...partial }

  // sync無効化時: 最後の同期 → 停止 → 書き戻し → 設定保存 → 控えの削除
  //
  // **順序に意味がある。**
  // - 最後の同期は `stopSync()` の**前**でなければ走らない（止めると `syncInstance` が
  //   消える）。上げるだけでなく取り込みもするので、切る前に1回やる値打ちがある。
  //   ただし、ここで上げた内容を他のPCが受け取るのは、そのPCの次の同期のときである
  // - 書き戻しに失敗したら**設定を変えずに投げる**。ローカルDBは残るので何も失われず、
  //   同期が入ったままなのが正しい
  // - 設定の保存は**削除より前**。順序が逆だと、削除の失敗で設定が保存されず、
  //   二度と同期を切れなくなる（issue #1270）
  if (current.enabled && !updated.enabled) {
    try {
      if (syncInstance) {
        await syncInstance.syncNow()
      }
    } catch {
      // 最終syncに失敗しても、切る処理は続行する
    }

    await stopSync()

    await writeBackLocalDb()

    saveSyncConfig(updated)

    removeLocalDbDirectory()

    return
  }

  saveSyncConfig(updated)

  if (updated.enabled) {
    await startSync(updated)
  } else if (!current.enabled) {
    // 既に無効で、設定変更のみ（interval等）
    await stopSync()
  }
}
