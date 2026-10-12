/**
 * migration の回帰テストが使う「その migration の1つ手前の DB」を、本番と同じ当て方で組む。
 *
 * 新規インストールの起動と同じ順に、init を作り（`bootstrapSchema`）、その記録を置き
 * （`createBaseline`）、残りをアプリに束ねた一覧（`BUNDLED_MIGRATIONS`）から
 * `deployPendingMigrations` で当てる。当てる途中の外部キーの状態も、適用の記録も本番と同じになる。
 *
 * `deployPendingMigrations` は `databaseInitializer` を import するので、呼び出す側のテストは
 * それを `vi.mock` しておくこと（DB の場所はここで明示して渡すので、`getDatabasePath` は呼ばれない）。
 */
import { createBaseline } from "../../electron-src/lib/prisma/schema/baselineMigrations"
import { BUNDLED_MIGRATIONS } from "../../electron-src/lib/prisma/schema/bundledMigrations"
import {
  applyMigrationSql,
  type MigrationScript,
} from "../../electron-src/lib/prisma/schema/migrationApplier"
import { deployPendingMigrations } from "../../electron-src/lib/prisma/schema/migrationDeployer"
import { bootstrapSchema } from "../../electron-src/lib/prisma/schema/schemaBootstrap"
import type { SqliteDatabase } from "../../electron-src/lib/prisma/sqliteSchemaUtils"
import { createPrismaClientForPath } from "./testPrismaClient"

/** アプリに束ねた migration を名前で引く。無ければ例外（名前の打ち間違いを空振りにしない） */
const findBundledMigration = (migrationName: string): MigrationScript => {
  const migration = BUNDLED_MIGRATIONS.find(
    (bundledMigration) => bundledMigration.name === migrationName
  )
  if (!migration) {
    throw new Error(`アプリに束ねた migration にありません: ${migrationName}`)
  }
  return migration
}

/**
 * `dbPath` に、init から `targetMigration` の1つ手前までを当てた DB を作る。
 * `targetMigration` 自身は当てない（旧形状の行を入れてから `applyAppMigration` で当てる）
 */
export async function buildDatabaseBeforeMigration(
  dbPath: string,
  targetMigration: string
): Promise<void> {
  const targetIndex = BUNDLED_MIGRATIONS.indexOf(
    findBundledMigration(targetMigration)
  )
  if (targetIndex === 0) {
    throw new Error(`init より前の DB は組めません: ${targetMigration}`)
  }

  await bootstrapSchema(dbPath)
  const prisma = createPrismaClientForPath(dbPath)
  try {
    await createBaseline(prisma)
  } finally {
    await prisma.$disconnect()
  }

  await deployPendingMigrations({
    dbPath,
    migrations: BUNDLED_MIGRATIONS.slice(0, targetIndex),
  })
}

/**
 * アプリの migration 1本を、本番の当て方（`applyMigrationSql` ＝ 外部キーを OFF に戻してから
 * `db.exec`）で、開いている接続へ当てる
 */
export function applyAppMigration(
  db: SqliteDatabase,
  migrationName: string
): void {
  applyMigrationSql(db, findBundledMigration(migrationName).sql)
}
