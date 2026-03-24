/**
 * NAS同期サービス
 *
 * sqlite-nas-syncのSyncInstanceをラップし、
 * アプリライフサイクルとIPC通信を管理する。
 *
 * sync有効時はローカルDBを使用し、NAS経由で他PCと同期する。
 * sync無効時はNAS上のDBを直接使用する（従来動作）。
 */

import type Database from "better-sqlite3"
import { BrowserWindow } from "electron"
import * as fs from "fs"
import type { SyncInstance, SyncResult } from "sqlite-nas-sync"

import { getDataDirectory } from "../dataManager"
import {
  ensureClientId,
  ensureSyncDirectory,
  getLocalDbDirectory,
  getLocalDbPath,
  getNasDbPath,
  getNasSyncPath,
  getSchemaVersion,
  loadSyncConfig,
  saveSyncConfig,
} from "./syncConfig"
import { SYNC_TABLES } from "./syncTableConfig"
import type { SyncAppConfig, SyncAppStatus } from "./types"

let syncInstance: SyncInstance | null = null

let currentStatus: SyncAppStatus = {
  state: "disabled",
  lastSyncTime: null,
  lastError: null,
  syncCount: 0,
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

/** enforceTombstonesの対象テーブル名（SYNC_TABLESからDeletedRecord自身を除外） */
const TOMBSTONE_TARGET_TABLES = new Set(
  SYNC_TABLES.filter((t) => t.name !== "DeletedRecord").map((t) => t.name)
)

/**
 * sync後のtombstone適用
 *
 * DeletedRecordに記録された全テーブルの削除済みレコードを物理削除する。
 * SQLインジェクション防止のため、SYNC_TABLESに含まれるテーブル名のみ許可。
 */
function enforceTombstones(db: Database.Database): void {
  try {
    const tombstones = db
      .prepare(
        `SELECT recordId, tableName FROM "DeletedRecord" GROUP BY tableName, recordId`
      )
      .all() as Array<{ recordId: string; tableName: string }>

    for (const { recordId, tableName } of tombstones) {
      if (!TOMBSTONE_TARGET_TABLES.has(tableName)) continue

      // テーブル名はSYNC_TABLESのホワイトリストで検証済みのため安全
      db.prepare(`DELETE FROM "${tableName}" WHERE "id" = ?`).run(recordId)
    }
  } catch (error) {
    console.error("Failed to enforce tombstones:", error)
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
    tables: SYNC_TABLES,
    intervalMs: config.intervalMs,
    changelogRetentionDays: config.changelogRetentionDays,
    schemaVersion: getSchemaVersion(),
    onAfterSync: (db: Database.Database, _result: SyncResult) => {
      enforceTombstones(db)
      updateStatus({
        state: "idle",
        lastSyncTime: new Date().toISOString(),
        lastError: null,
        syncCount: currentStatus.syncCount + 1,
      })
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
