/**
 * NAS同期設定の永続化
 *
 * sync設定はマシン固有（clientId）のため、
 * 同期対象DBではなくElectronのuserDataディレクトリに保存する。
 * NAS syncパスはデータディレクトリから自動導出（{dataDir}/sync/）。
 */

import * as crypto from "crypto"
import { app } from "electron"
import * as fs from "fs"
import * as path from "path"

import { getDataDirectory } from "../dataManager"
import { listLocalMigrationNames } from "../prisma/schema/migrationDeployer"
import type { SyncAppConfig } from "./types"
import { DEFAULT_SYNC_CONFIG } from "./types"

/**
 * prisma/migrationsから最新マイグレーション名を取得し、schemaVersionとして返す。
 * マイグレーションガード（migrationGuard）と同じ解決ロジックを使い、
 * 起動時チェックと同期ゲートが必ず同じバージョン文字列を参照するようにする。
 */
export function getSchemaVersion(): string {
  try {
    const entries = listLocalMigrationNames().filter((migrationName) =>
      /^\d{14}_/.test(migrationName)
    )
    return entries.length > 0 ? entries[entries.length - 1] : "unknown"
  } catch {
    return "unknown"
  }
}

function getConfigPath(): string {
  return path.join(app.getPath("userData"), "sync-config.json")
}

/** sqlite-nas-syncが使用するNAS上のsyncディレクトリパスを返す */
export function getNasSyncPath(): string {
  return path.join(getDataDirectory(), "sync")
}

/** sync有効時のローカルDBディレクトリを返す */
export function getLocalDbDirectory(): string {
  return path.join(app.getPath("userData"), "score-at-once")
}

/** sync有効時のローカルDBパスを返す */
export function getLocalDbPath(): string {
  return path.join(getLocalDbDirectory(), "database.db")
}

/** NAS上のDBパスを返す（sync無効時/コピー元として使用） */
export function getNasDbPath(): string {
  return path.join(getDataDirectory(), "database.db")
}

/** syncディレクトリが存在しなければ作成する */
export function ensureSyncDirectory(): void {
  const syncPath = getNasSyncPath()
  if (!fs.existsSync(syncPath)) {
    fs.mkdirSync(syncPath, { recursive: true })
  }
}

export function loadSyncConfig(): SyncAppConfig {
  const configPath = getConfigPath()
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8")
      return { ...DEFAULT_SYNC_CONFIG, ...JSON.parse(raw) }
    }
  } catch (error) {
    console.error("Failed to load sync config:", error)
  }
  return { ...DEFAULT_SYNC_CONFIG }
}

export function saveSyncConfig(config: SyncAppConfig): void {
  const configPath = getConfigPath()
  const directory = path.dirname(configPath)
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true })
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8")
}

export function ensureClientId(config: SyncAppConfig): SyncAppConfig {
  if (!config.clientId) {
    config.clientId = crypto.randomUUID()
    saveSyncConfig(config)
  }
  return config
}
