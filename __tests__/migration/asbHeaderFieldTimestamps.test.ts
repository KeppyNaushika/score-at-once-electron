/**
 * 20260802030000_asb_header_field_timestamps のデータ移行テスト
 *
 * 検証すること:
 * - createdAt / updatedAt が**親 AsbDefinition の時刻**を引き継ぐ
 * - 移行を走らせた時刻（now）が入らない
 * - 他の列が変わらない
 * - 定義の削除でカスケード削除される（作り直しでFKが壊れていない）
 *
 * updatedAt は sqlite-nas-sync の LWW 判定に使われる。ここに「移行を走らせた時刻」を
 * 入れると、後からアップグレードした端末の触ってもいない行が、先にアップグレードした
 * 端末の実際の編集を上回って勝ち、編集が黙って巻き戻る。
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createBaseline } from "../../electron-src/lib/prisma/schema/baselineMigrations"
import { bootstrapSchema } from "../../electron-src/lib/prisma/schema/schemaBootstrap"
import { createPrismaClientForPath } from "../helpers/testPrismaClient"

const TEST_ROOT = path.join(os.tmpdir(), "asb-header-field-timestamps")
const DB_PATH = path.join(TEST_ROOT, "database.db")
const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations")
const TARGET_MIGRATION = "20260802030000_asb_header_field_timestamps"

vi.mock("../../electron-src/lib/prisma/databaseInitializer", () => ({
  getDatabasePath: () => DB_PATH,
}))

type SqliteDatabase = InstanceType<typeof Database>

const withDatabase = <T>(operation: (db: SqliteDatabase) => T): T => {
  const db = new Database(DB_PATH)
  try {
    return operation(db)
  } finally {
    db.close()
  }
}

const migrationNames = (): string[] =>
  fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

const applyMigration = (db: SqliteDatabase, name: string): void => {
  db.exec(
    fs.readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf-8")
  )
}

async function buildDatabaseBeforeTargetMigration(): Promise<void> {
  bootstrapSchema(DB_PATH)
  const prisma = createPrismaClientForPath(DB_PATH)
  try {
    await createBaseline(prisma)
  } finally {
    await prisma.$disconnect()
  }

  const names = migrationNames()
  const targetIndex = names.indexOf(TARGET_MIGRATION)
  expect(targetIndex).toBeGreaterThan(0)

  withDatabase((db) => {
    for (const name of names.slice(0, targetIndex)) {
      if (name === "20260322232329_init") continue
      applyMigration(db, name)
    }
  })
}

const DEFINITION_CREATED = "2026-05-01T00:00:00.000+00:00"
const DEFINITION_UPDATED = "2026-06-15T09:30:00.000+00:00"

function seedLegacyRows(db: SqliteDatabase): void {
  const run = (sql: string, params: unknown[]) => db.prepare(sql).run(params)

  run(
    `INSERT INTO "User" (id, username, name, role, createdAt, updatedAt) VALUES (?,?,?,?,?,?)`,
    [
      "user-1",
      "teacher",
      "教員",
      "teacher",
      DEFINITION_CREATED,
      DEFINITION_CREATED,
    ]
  )
  run(
    `INSERT INTO "AsbDefinition" (id, name, userId, createdAt, updatedAt) VALUES (?,?,?,?,?)`,
    ["def-1", "数学 解答用紙", "user-1", DEFINITION_CREATED, DEFINITION_UPDATED]
  )
  run(
    `INSERT INTO "AsbHeaderField" (id, definitionId, type, label, widthMm, heightMm, gridCount, lineStyle, lineWidth, "order")
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ["field-1", "def-1", "field", "氏名", 40, 8, 0, "solid", 0.4, 0]
  )
}

interface HeaderFieldRow {
  id: string
  label: string
  widthMm: number
  order: number
  createdAt: string
  updatedAt: string
}

const readRows = (): HeaderFieldRow[] =>
  withDatabase(
    (db) =>
      db
        .prepare(
          `SELECT id, label, widthMm, "order", createdAt, updatedAt
           FROM "AsbHeaderField" ORDER BY "order" ASC`
        )
        .all() as HeaderFieldRow[]
  )

async function migrate(): Promise<void> {
  await buildDatabaseBeforeTargetMigration()
  withDatabase((db) => {
    seedLegacyRows(db)
    applyMigration(db, TARGET_MIGRATION)
  })
}

beforeEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(TEST_ROOT, { recursive: true })
})

afterEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe("ヘッダー項目に作成日時・更新日時を足す", () => {
  it("親の定義の時刻を引き継ぐ（移行を走らせた時刻を入れない）", async () => {
    await migrate()

    const [row] = readRows()
    expect(row.createdAt).toBe(DEFINITION_CREATED)
    expect(row.updatedAt).toBe(DEFINITION_UPDATED)
  })

  it("他の列は変わらない", async () => {
    await migrate()

    expect(readRows()[0]).toMatchObject({
      id: "field-1",
      label: "氏名",
      widthMm: 40,
      order: 0,
    })
  })

  it("定義を消すとカスケード削除される（作り直しでFKが壊れていない）", async () => {
    await migrate()

    const definition = withDatabase(
      (db) =>
        db
          .prepare(
            `SELECT sql FROM sqlite_master WHERE type='table' AND name='AsbHeaderField'`
          )
          .get() as { sql: string }
    )
    expect(definition.sql).toContain('REFERENCES "AsbDefinition" ("id")')

    const remaining = withDatabase((db) => {
      db.pragma("foreign_keys = ON")
      db.prepare(`DELETE FROM "AsbDefinition" WHERE id = 'def-1'`).run()
      return db
        .prepare(`SELECT COUNT(*) AS count FROM "AsbHeaderField"`)
        .get() as { count: number }
    })
    expect(remaining.count).toBe(0)
    expect(withDatabase((db) => db.pragma("foreign_key_check"))).toEqual([])
  })
})
