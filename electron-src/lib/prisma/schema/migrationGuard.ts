import { PrismaClient } from "@prisma/client"

import { tableExists } from "../databaseUtils"
import { listLocalMigrationNames } from "./migrationDeployer"

/**
 * 「DBがアプリより新しい」エラーの識別マーカー。
 * エラーが上位でラップされてもメッセージ文字列から判別できるようにする。
 */
export const DB_NEWER_THAN_APP_MARKER = "DB_NEWER_THAN_APP"

export class DatabaseNewerThanAppError extends Error {
  readonly unknownMigrations: string[]

  constructor(unknownMigrations: string[]) {
    super(
      `[${DB_NEWER_THAN_APP_MARKER}] このデータベースは、より新しいバージョンの Score at Once で更新されています。` +
        `データ保護のため起動を中止しました。アプリを最新バージョンに更新してから再度起動してください。` +
        `（未知のマイグレーション: ${unknownMigrations.join(", ")}）`
    )
    this.name = "DatabaseNewerThanAppError"
    this.unknownMigrations = unknownMigrations
  }
}

/**
 * DBに「アプリが知らない、より新しいマイグレーション」が適用済みの場合に例外を投げる。
 *
 * 新しいバージョンのアプリでマイグレーション済みのDB（NAS共有・同期フォルダ経由を含む）を
 * 旧バージョンのアプリで開くと、スキーマ不整合のまま読み書きしてデータを壊す恐れがあるため、
 * 書き込みが発生する前に起動を中止する。
 *
 * 旧カスタムマイグレーションシステム由来のエントリは、アプリ同梱の最新マイグレーション名より
 * 辞書順で古いため対象外となる（prisma migrate dev のタイムスタンプ接頭辞は常に単調増加）。
 */
export const assertDatabaseNotNewerThanApp = async (
  prisma: PrismaClient
): Promise<void> => {
  if (!(await tableExists(prisma, "_prisma_migrations"))) return

  const localNames = listLocalMigrationNames()
  if (localNames.length === 0) {
    // マイグレーション同梱なし（開発環境の異常系等）では判定不能のためスキップ
    console.warn(
      "assertDatabaseNotNewerThanApp: no local migrations found, skipping check"
    )
    return
  }

  const latestLocal = localNames[localNames.length - 1]
  const localSet = new Set(localNames)

  const applied = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT "migration_name" FROM "_prisma_migrations" WHERE "rolled_back_at" IS NULL`
  )

  const unknownNewer = applied
    .map((row) => row.migration_name)
    .filter((name) => !localSet.has(name) && name > latestLocal)
    .sort()

  if (unknownNewer.length > 0) {
    throw new DatabaseNewerThanAppError(unknownNewer)
  }
}
