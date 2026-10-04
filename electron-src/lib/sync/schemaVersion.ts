/**
 * 同期ゲートが参照するスキーマバージョン
 *
 * prisma/migrationsから最新マイグレーション名を取得し、schemaVersionとして返す。
 * マイグレーションガード（migrationGuard）と同じ解決ロジックを使い、
 * 起動時チェックと同期ゲートが必ず同じバージョン文字列を参照するようにする。
 *
 * syncConfig.ts ではなくこのファイルに置いている理由:
 * DBパスの決定（syncConfig）とマイグレーション一覧の読み取り（migrationApplier）は
 * 別の関心なので、後者に依存するのはこのファイルだけに閉じる。（一覧の読み取りが
 * migrationDeployer にあった頃は、`databaseInitializer` → `sync/syncConfig` →
 * `migrationDeployer` → `databaseInitializer` の循環を避ける意味もあった）
 */

import { listLocalMigrationNames } from "../prisma/schema/migrationApplier"

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
