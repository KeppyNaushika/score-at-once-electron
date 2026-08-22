/**
 * NAS同期サービス
 *
 * sqlite-nas-syncのSyncInstanceをラップし、
 * アプリライフサイクルとIPC通信を管理する。
 *
 * sync有効時はローカルDBを使用し、NAS経由で他PCと同期する。
 * sync無効時はNAS上のDBを直接使用する（従来動作）。
 *
 * 削除の伝搬はライブラリの `_tombstone`（deletedAt と updatedAt のLWW）に一本化している。
 * 時刻を見ずに id を消し続けるアプリ側の削除記録は持たない（issue #918）。
 *
 * 別id・同一ユニークキーの行の「畳み」も、負けた行の子の引き取りも、畳み先の伝播も
 * ライブラリ側（v0.16.0）が行う。既に `_tombstone` を持つローカルDBには
 * `setupSync` が `mergedInto` 列を足すので、アプリ側の移行処理は要らない。
 */

import { BrowserWindow } from "electron"
import * as fs from "fs"
import type { SyncInstance, SyncResult } from "sqlite-nas-sync"

import { syncFoldTableLabel } from "@/lib/shared/syncFoldLabels"

import { getDataDirectory } from "../dataManager"
import { recordAuditLog } from "../prisma/auditLog"
import { getSchemaVersion } from "./schemaVersion"
import {
  ensureClientId,
  ensureSyncDirectory,
  getLocalDbDirectory,
  getLocalDbPath,
  getNasDbPath,
  getNasSyncPath,
  loadSyncConfig,
  saveSyncConfig,
} from "./syncConfig"
import { SYNC_EXCLUDE_TABLES, SYNC_TABLE_OPTIONS } from "./syncTableConfig"
import type {
  SyncAppConfig,
  SyncAppStatus,
  SyncRecordFold,
  VersionMismatchRemote,
} from "./types"

/** SyncResultからバージョン不一致リモートの一覧を抽出する */
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
}

function updateStatus(partial: Partial<SyncAppStatus>): void {
  currentStatus = { ...currentStatus, ...partial }
  broadcastSyncStatus()
}

function broadcastSyncStatus(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send("sync:status-changed", currentStatus)
    } catch {
      // ウィンドウが既に閉じられている場合は無視
    }
  }
}

/**
 * 畳みが起きたことを renderer へ押し出す。
 *
 * **既読は持たない。** 同期はアプリが動いている間しか走らないので、畳みの瞬間には
 * 必ず窓が開いている。読んだかどうかを覚えると、その状態がまた新しい保存先になる。
 * あとから見返す口は監査ログ（`sync.merge`）1つに寄せる。
 *
 * 中身は加工しない（何件が何になったかの数え上げは renderer 側で組み立てる）。
 */
function broadcastRecordFolds(folds: SyncRecordFold[]): void {
  if (folds.length === 0) return
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send("sync:records-folded", folds)
    } catch {
      // ウィンドウが既に閉じられている場合は無視
    }
  }
}

/**
 * 畳みを監査ログへ残す（あとから見返す口はここ1つ。専用の履歴画面は作らない）。
 *
 * `coalesceKey` は**同じ端末が同じ畳みを二度書くのを止めるだけ**で、端末をまたいだ
 * 重複は畳めない。畳みは各端末でそれぞれ起きるが、相手の記録が届くのは相手が書いた
 * 次の同期以降で、書く時点のローカルDBにはまだ無い（`recordAuditLog` の突き合わせは
 * 書く瞬間のローカル行に対してしか働かない）。端末数ぶん行が並ぶのはそのため。
 */
async function recordFoldAuditLogs(folds: SyncRecordFold[]): Promise<void> {
  for (const fold of folds) {
    await recordAuditLog({
      action: "sync.merge",
      // システム操作は null（利用者が起こした操作ではない）
      userId: null,
      entityType: fold.tableName,
      entityId: fold.losingId,
      target: syncFoldTableLabel(fold.tableName),
      extra: {
        losingId: fold.losingId,
        winningId: fold.winningId,
        removedLocalRow: fold.removedLocalRow,
        movedChildren: fold.movedChildren,
        lostChildren: fold.lostChildren,
      },
      coalesceKey: `sync.merge:${fold.tableName}:${fold.losingId}`,
    })
  }
}

/**
 * ローカルDBを準備する（sync有効化時）
 *
 * ローカルDBが存在しない場合、NAS上のDBをコピーして初期化する。
 */
function ensureLocalDb(): void {
  const localDir = getLocalDbDirectory()
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true })
  }

  const localDbPath = getLocalDbPath()
  if (!fs.existsSync(localDbPath)) {
    const nasDbPath = getNasDbPath()
    if (fs.existsSync(nasDbPath)) {
      console.log(`Copying NAS DB to local: ${nasDbPath} → ${localDbPath}`)
      fs.copyFileSync(nasDbPath, localDbPath)
    }
  }
}

/**
 * ローカルDBをクリーンアップする（sync無効化時）
 *
 * ローカルDBの内容をNAS側に書き戻してからローカルを削除する。
 */
function cleanupLocalDb(): void {
  const localDbPath = getLocalDbPath()
  if (!fs.existsSync(localDbPath)) return

  // ローカルDBの内容をNAS側にコピー（最新状態を保持）
  const nasDbPath = getNasDbPath()
  const nasDir = getDataDirectory()
  if (!fs.existsSync(nasDir)) {
    fs.mkdirSync(nasDir, { recursive: true })
  }
  console.log(`Writing back local DB to NAS: ${localDbPath} → ${nasDbPath}`)
  fs.copyFileSync(localDbPath, nasDbPath)

  // ローカルDBディレクトリを削除
  const localDir = getLocalDbDirectory()
  fs.rmSync(localDir, { recursive: true, force: true })
  console.log(`Removed local DB directory: ${localDir}`)
}

/** アプリ起動時の初期化。設定が有効ならsyncを開始する。 */
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
  ensureLocalDb()

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
      })

      // 畳みは黙って行を1つにする操作なので、起きた瞬間に伝える。
      broadcastRecordFolds(result.folds)
      // 記録はベストエフォート（`recordAuditLog` は失敗を握りつぶす）。同期の
      // コールバックは同期関数なので、書き込みの完了は待たずに切り離す。
      void recordFoldAuditLogs(result.folds)
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
  updateStatus({ state: "disabled" })
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

  // sync無効化時: ローカルDBをNASに書き戻して削除
  if (current.enabled && !updated.enabled) {
    await stopSync()

    // 最終sync試行（エラーは無視）
    try {
      if (syncInstance) {
        await syncInstance.syncNow()
      }
    } catch {
      // 最終syncに失敗してもクリーンアップは続行
    }

    cleanupLocalDb()
  }

  saveSyncConfig(updated)

  if (updated.enabled) {
    await startSync(updated)
  } else if (!current.enabled) {
    // 既に無効で、設定変更のみ（interval等）
    await stopSync()
  }
}
