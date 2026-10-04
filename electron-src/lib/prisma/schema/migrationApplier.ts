/**
 * マイグレーションSQLの当て方と、適用記録の読み書き
 *
 * 起動時のマイグレーション（`migrationDeployer.ts`）と、統合アーカイブ（.sao）を開くときの
 * 現行化（`import/unified-archive/archiveOpener.ts`）が、同じ当て方を共有するために切り出した
 * （docs/unified-archive-design.md §4.1 の5）。
 *
 * electron・`databaseInitializer` は import しない（アーカイブの現行化は取り込み先の DB の場所に
 * 依存しない）。同梱マイグレーションの場所の解決だけが、パッケージ化環境で electron を
 * 遅延で読む（`getMigrationsDir`。electron 未ロードなら諦める）。
 */

import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"

import type { SqliteDatabase } from "../sqliteSchemaUtils"

/**
 * 1本のマイグレーションSQLを、外部キー制約を既知の状態（OFF）へ戻してから流す。
 *
 * `PRAGMA foreign_keys` は接続の状態なので、直前に流したファイルが最後に置いた値が
 * そのまま残る（RedefineTables 系は `OFF→ON`、テーブル改名系は `ON→OFF` で終わる）。
 * 開始時点を固定しておかないと、後から足したマイグレーションの挙動が
 * 「その起動で何本前に走ったか」で変わる。
 */
export const applyMigrationSql = (db: SqliteDatabase, sql: string): void => {
  db.pragma("foreign_keys = OFF")
  db.exec(sql)
}

/** _prisma_migrations から適用済みマイグレーション名の集合を取得する */
export const listAppliedMigrationNames = (db: SqliteDatabase): Set<string> => {
  const rows = db
    .prepare<[], { migration_name: string }>(
      `SELECT "migration_name" FROM "_prisma_migrations" WHERE "rolled_back_at" IS NULL`
    )
    .all()
  return new Set(rows.map((row) => row.migration_name))
}

/**
 * 当て終えたマイグレーションを _prisma_migrations に記録する。
 * checksum は SQL 本文の sha256、finished_at は記録した時刻
 */
export const recordAppliedMigration = (
  db: SqliteDatabase,
  name: string,
  sql: string,
  startedAt: string
): void => {
  const checksum = crypto.createHash("sha256").update(sql).digest("hex")
  db.prepare<[string, string, string, string, string]>(
    `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
       VALUES (?, ?, ?, ?, ?, 1)`
  ).run(
    crypto.randomUUID(),
    checksum,
    new Date().toISOString(),
    name,
    startedAt
  )
}

/** prisma/migrations/ に同梱されているマイグレーション名を昇順で返す */
export const listLocalMigrationNames = (dir?: string | null): string[] => {
  const migrationsDir = dir ?? getMigrationsDir()
  if (!migrationsDir || !fs.existsSync(migrationsDir)) return []
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort()
}

/** prisma/migrations/ ディレクトリのパスを解決する */
export const getMigrationsDir = (): string | null => {
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
