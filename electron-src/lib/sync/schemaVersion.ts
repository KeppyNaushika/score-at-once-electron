/**
 * 同期ゲートが参照するスキーマバージョン
 *
 * prisma/migrationsから最新マイグレーション名を取得し、schemaVersionとして返す。
 * マイグレーションガード（migrationGuard）と同じ解決ロジックを使い、
 * 起動時チェックと同期ゲートが必ず同じバージョン文字列を参照するようにする。
 *
 * syncConfig.ts ではなくこのファイルに置いている理由:
 * `databaseInitializer` → `sync/syncConfig` → `prisma/schema/migrationDeployer`
 * → `databaseInitializer` という循環を作らないため。DBパスの決定（syncConfig）と
 * マイグレーション一覧の読み取り（migrationDeployer）は別の関心なので、
 * 後者に依存するのはこのファイルだけに閉じる。
 */

import { listLocalMigrationNames } from "../prisma/schema/migrationDeployer"

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
