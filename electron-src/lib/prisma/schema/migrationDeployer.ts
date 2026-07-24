import Database from "better-sqlite3"
import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"

import { getDatabasePath } from "../databaseInitializer"
import { hasTable, type SqliteDatabase } from "../sqliteSchemaUtils"
import { createBackup, restoreBackup } from "./bridgeMigrations"

/** _prisma_migrations から適用済みマイグレーション名の集合を取得する */
const listAppliedMigrationNames = (db: SqliteDatabase): Set<string> => {
  const rows = db
    .prepare(
      `SELECT "migration_name" FROM "_prisma_migrations" WHERE "rolled_back_at" IS NULL`
    )
    .all() as { migration_name: string }[]
  return new Set(rows.map((row) => row.migration_name))
}

/**
 * prisma/migrations/ ディレクトリから未適用のマイグレーションを検出し、順番に適用する。
 * _prisma_migrationsテーブルを参照・更新して適用状態を管理する。
 * 適用前にDBファイルをバックアップし、失敗時は復元する。
 *
 * SQLの実行は better-sqlite3 の exec に委ね、複数文・PRAGMA・文字列リテラル内の
 * セミコロンを SQLite 本体に正しく解釈させる（自前の `split(";")` は使わない）。
 * また各文は自動コミットで実行されるため、RENAME 系マイグレーションの
 * `PRAGMA foreign_keys` が意図どおり効く。
 */
export const deployPendingMigrations = (options?: {
  migrationsDir?: string
}): number => {
  const migrationsDir = options?.migrationsDir ?? getMigrationsDir()
  if (!migrationsDir || !fs.existsSync(migrationsDir)) {
    console.warn(`Migrations directory not found: ${migrationsDir}`)
    return 0
  }

  const db = new Database(path.resolve(getDatabasePath()))
  db.pragma("busy_timeout = 5000")

  try {
    if (!hasTable(db, "_prisma_migrations")) {
      console.warn(
        "deployPendingMigrations: _prisma_migrations table not found, skipping"
      )
      return 0
    }

    const appliedNames = listAppliedMigrationNames(db)

    // 未適用のマイグレーションを抽出
    const pendingDirs = listLocalMigrationNames(migrationsDir).filter(
      (dirName) => {
        if (appliedNames.has(dirName)) return false
        return fs.existsSync(path.join(migrationsDir, dirName, "migration.sql"))
      }
    )

    if (pendingDirs.length === 0) return 0

    // 適用前にバックアップを作成（PRAGMAを含むSQLはトランザクション化できないため、
    // 失敗時はファイルレベルで復元する）
    const backupPath = createBackup()

    const recordApplied = db.prepare(
      `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
       VALUES (?, ?, ?, ?, ?, 1)`
    )

    let appliedCount = 0

    for (const dirName of pendingDirs) {
      const sqlPath = path.join(migrationsDir, dirName, "migration.sql")
      const sql = fs.readFileSync(sqlPath, "utf-8")
      const checksum = crypto.createHash("sha256").update(sql).digest("hex")

      console.info(`Applying migration: ${dirName}`)
      const startedAt = new Date().toISOString()

      try {
        db.exec(sql)
        recordApplied.run(
          crypto.randomUUID(),
          checksum,
          new Date().toISOString(),
          dirName,
          startedAt
        )
        appliedCount++
        console.info(`Migration applied: ${dirName}`)
      } catch (error) {
        console.error(`Migration failed: ${dirName}`, error)
        // restore はファイル上書きのため、先に接続を閉じる（Windowsでのロック回避）
        db.close()
        if (backupPath) {
          console.info("Restoring database from pre-migration backup...")
          restoreBackup(backupPath)
        }
        throw new Error(
          `Migration ${dirName} failed: ${error instanceof Error ? error.message : error}`
        )
      }
    }

    if (appliedCount > 0) {
      console.info(`${appliedCount} migration(s) applied successfully`)
    }

    return appliedCount
  } finally {
    if (db.open) db.close()
  }
}

/** prisma/migrations/ に同梱されているマイグレーション名を昇順で返す */
export const listLocalMigrationNames = (dir?: string): string[] => {
  const migrationsDir = dir ?? getMigrationsDir()
  if (!migrationsDir || !fs.existsSync(migrationsDir)) return []
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort()
}

/** prisma/migrations/ ディレクトリのパスを解決する */
const getMigrationsDir = (): string | null => {
  // 開発環境: プロジェクトルートの prisma/migrations/
  const devPath = path.join(process.cwd(), "prisma", "migrations")
  if (fs.existsSync(devPath)) return devPath

  // パッケージ化環境: app.asar の隣
  try {
    const { app } = require("electron")
    const appPath = app.getAppPath()
    const candidates = [
      path.join(appPath, "prisma", "migrations"),
      path.join(appPath, "..", "prisma", "migrations"),
      path.join(path.dirname(appPath), "prisma", "migrations"),
    ]
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate
    }
  } catch {
    // electron未ロード時
  }

  return null
}
