import * as fs from "fs"
import * as path from "path"

import { getDatabasePath } from "../databaseInitializer"
import { openAppDatabase } from "../sqliteConnection"
import { hasTable } from "../sqliteSchemaUtils"
import { createBackup, restoreBackup } from "./bridgeMigrations"
import {
  applyMigrationSql,
  getMigrationsDir,
  listAppliedMigrationNames,
  listLocalMigrationNames,
  recordAppliedMigration,
} from "./migrationApplier"

/**
 * prisma/migrations/ ディレクトリから未適用のマイグレーションを検出し、順番に適用する。
 * _prisma_migrationsテーブルを参照・更新して適用状態を管理する。
 * 適用前にDBファイルをバックアップし、失敗時は復元する。
 *
 * SQLの実行は better-sqlite3 の exec に委ね、複数文・PRAGMA・文字列リテラル内の
 * セミコロンを SQLite 本体に正しく解釈させる（自前の `split(";")` は使わない）。
 * また各文は自動コミットで実行されるため、RENAME 系マイグレーションの
 * `PRAGMA foreign_keys` が意図どおり効く。
 *
 * `PRAGMA foreign_keys` は接続に紐づく状態で、1本の接続で全ての未適用ぶんを流す以上、
 * あるファイルが最後に置いた値が次のファイルの初期状態になる。マイグレーション側は
 * 自分の開始時点の状態を当てにできないため、**1本ごとに既知の状態（OFF）へ戻してから**
 * 流す（`applyMigrationSql`）。`ON` を要求するマイグレーション（子の外部キー参照を
 * 追随させる `ALTER TABLE … RENAME TO` 等）は自分で `ON` を敷くので、これで壊れない。
 */
export const deployPendingMigrations = (options?: {
  migrationsDir?: string
  /**
   * 当てる DB。省略すると起動時に決まった DB（`getDatabasePath()`）。
   * 共有プロファイルの手元の控えを、動いている DB とは別に作るときに渡す
   */
  dbPath?: string
}): number => {
  const migrationsDir = options?.migrationsDir ?? getMigrationsDir()
  if (!migrationsDir || !fs.existsSync(migrationsDir)) {
    console.warn(`Migrations directory not found: ${migrationsDir}`)
    return 0
  }

  // マイグレーションもアプリの表を書くので、同期のトリガーが取りこぼさない接続で開く
  const dbPath = path.resolve(options?.dbPath ?? getDatabasePath())
  const db = openAppDatabase(dbPath)

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
    const backupPath = createBackup(dbPath)

    let appliedCount = 0

    for (const dirName of pendingDirs) {
      const sqlPath = path.join(migrationsDir, dirName, "migration.sql")
      const sql = fs.readFileSync(sqlPath, "utf-8")

      console.info(`Applying migration: ${dirName}`)
      const startedAt = new Date().toISOString()

      try {
        applyMigrationSql(db, sql)
        recordAppliedMigration(db, dirName, sql, startedAt)
        appliedCount++
        console.info(`Migration applied: ${dirName}`)
      } catch (error) {
        console.error(`Migration failed: ${dirName}`, error)
        // restore はファイル上書きのため、先に接続を閉じる（Windowsでのロック回避）
        db.close()
        if (backupPath) {
          console.info("Restoring database from pre-migration backup...")
          restoreBackup(backupPath, dbPath)
        }
        throw new Error(
          `Migration ${dirName} failed: ${error instanceof Error ? error.message : error}`,
          { cause: error }
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
