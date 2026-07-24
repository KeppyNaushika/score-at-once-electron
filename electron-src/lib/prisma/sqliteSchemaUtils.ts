/**
 * better-sqlite3 生接続に対するスキーマ検査ユーティリティ（共通）
 *
 * schemaBootstrap / migrationDeployer など、Prisma を介さず sqlite_master を
 * 直接参照する箇所で共有する。テーブル検出方法の変更を一箇所に集約する。
 */
import type Database from "better-sqlite3"

/** better-sqlite3 の Database インスタンス型 */
export type SqliteDatabase = InstanceType<typeof Database>

/** DBに実在するユーザーテーブルの数を返す（SQLite内部テーブルを除く） */
export const countUserTables = (db: SqliteDatabase): number => {
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
    )
    .get() as { count: number }
  return Number(row.count)
}

/** 指定テーブルが存在するかを返す */
export const hasTable = (db: SqliteDatabase, tableName: string): boolean => {
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name = ?`
    )
    .get(tableName) as { count: number }
  return Number(row.count) > 0
}
