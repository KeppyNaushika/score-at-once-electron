import type { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { ensureBaselineUpToDate } from "../../electron-src/lib/prisma/schema/baselineMigrations"
import { listLocalMigrationNames } from "../../electron-src/lib/prisma/schema/migrationApplier"
import {
  assertDatabaseNotNewerThanApp,
  DatabaseNewerThanAppError,
} from "../../electron-src/lib/prisma/schema/migrationGuard"
import { createPrismaClientForPath } from "../helpers/testPrismaClient"

const TEST_DB_DIR = path.resolve(__dirname, "../../data")
const TEST_DB_PATH = path.join(TEST_DB_DIR, "test-migration-guard.db")

let prisma: PrismaClient

const createPrisma = () => createPrismaClientForPath(TEST_DB_PATH)

const resetDb = async () => {
  await prisma.$disconnect()
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
  fs.writeFileSync(TEST_DB_PATH, "")
  prisma = createPrisma()
  await prisma.$connect()
}

const createMigrationsTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "_prisma_migrations" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `)
}

const insertMigration = async (name: string, rolledBack = false) => {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count", "rolled_back_at")
     VALUES ('${name}-id', 'checksum', '2026-01-01T00:00:00Z', '${name}', '2026-01-01T00:00:00Z', 1, ${rolledBack ? "'2026-01-01T00:00:00Z'" : "NULL"})`
  )
}

const getMigrationNames = async (): Promise<string[]> => {
  const rows = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT "migration_name" FROM "_prisma_migrations" ORDER BY "migration_name"`
  )
  return rows.map((row) => row.migration_name)
}

/** 適用記録を、行の中身ごと移行名の順で読む */
const getMigrationRows = async () =>
  await prisma.$queryRawUnsafe<
    {
      id: string
      checksum: string
      finished_at: string | null
      migration_name: string
      rolled_back_at: string | null
      started_at: string
      applied_steps_count: number
    }[]
  >(
    `SELECT "id", "checksum", CAST("finished_at" AS TEXT) AS "finished_at", "migration_name", CAST("rolled_back_at" AS TEXT) AS "rolled_back_at", CAST("started_at" AS TEXT) AS "started_at", "applied_steps_count" FROM "_prisma_migrations" ORDER BY "migration_name"`
  )

beforeAll(async () => {
  if (!fs.existsSync(TEST_DB_DIR))
    fs.mkdirSync(TEST_DB_DIR, { recursive: true })
  prisma = createPrisma()
})

afterEach(async () => {
  await prisma.$disconnect()
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
})

afterAll(async () => {
  await prisma.$disconnect()
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
})

describe("assertDatabaseNotNewerThanApp", () => {
  it("_prisma_migrationsテーブルが無ければ何もしない", async () => {
    await resetDb()
    await expect(assertDatabaseNotNewerThanApp(prisma)).resolves.not.toThrow()
  })

  it("ローカルと同じマイグレーションのみ適用済みなら通過する", async () => {
    await resetDb()
    await createMigrationsTable()
    for (const name of listLocalMigrationNames()) {
      await insertMigration(name)
    }
    await expect(assertDatabaseNotNewerThanApp(prisma)).resolves.not.toThrow()
  })

  it("アプリが知らない新しいマイグレーションが適用済みなら例外を投げる", async () => {
    await resetDb()
    await createMigrationsTable()
    for (const name of listLocalMigrationNames()) {
      await insertMigration(name)
    }
    await insertMigration("20990101000000_future_feature")

    await expect(assertDatabaseNotNewerThanApp(prisma)).rejects.toThrow(
      DatabaseNewerThanAppError
    )
    await expect(assertDatabaseNotNewerThanApp(prisma)).rejects.toThrow(
      "20990101000000_future_feature"
    )
  })

  it("旧カスタムシステム由来の古い未知エントリは対象外", async () => {
    await resetDb()
    await createMigrationsTable()
    // 旧システムのエントリはタイムスタンプ接頭辞より辞書順で古い
    await insertMigration("0001_legacy_custom_migration")
    await expect(assertDatabaseNotNewerThanApp(prisma)).resolves.not.toThrow()
  })

  it("ロールバック済みの新しいマイグレーションは対象外", async () => {
    await resetDb()
    await createMigrationsTable()
    await insertMigration("20990101000000_future_feature", true)
    await expect(assertDatabaseNotNewerThanApp(prisma)).resolves.not.toThrow()
  })
})

describe("ensureBaselineUpToDate", () => {
  it("ベースライン未登録時、旧エントリのみ削除しローカル既知の記録は保持する", async () => {
    await resetDb()
    await createMigrationsTable()

    const localNames = listLocalMigrationNames()
    const knownLater = localNames[1] // init以外のローカル既知マイグレーション
    await insertMigration("0001_legacy_custom_migration")
    await insertMigration(knownLater)

    await ensureBaselineUpToDate(prisma)

    const names = await getMigrationNames()
    expect(names).not.toContain("0001_legacy_custom_migration")
    expect(names).toContain(knownLater)
    expect(names).toContain(localNames[0]) // init が挿入されている
  })

  it("ベースライン登録済みなら何も変更しない", async () => {
    await resetDb()
    await createMigrationsTable()
    const localNames = listLocalMigrationNames()
    await insertMigration(localNames[0])
    await insertMigration("0001_legacy_custom_migration")
    const before = await getMigrationRows()

    await ensureBaselineUpToDate(prisma)

    // ベースライン（init）が既にあるため、旧エントリも残り、足しも書き換えもしない。
    // 行の中身（id・checksum・日時）ごと比べる
    expect(before.map((row) => row.migration_name)).toEqual([
      "0001_legacy_custom_migration",
      localNames[0],
    ])
    expect(await getMigrationRows()).toEqual(before)
  })
})
