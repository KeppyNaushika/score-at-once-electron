/**
 * 20260802040000_exam_subtotal_group_deterministic_id のデータ移行テスト
 *
 * 検証すること:
 * - 重複行が1件へ潰れ、残るのは createdAt が最も古いもの
 * - フラグは重複行をまたいで OR される（読み取り側が「1行でも true なら選択」のため）
 * - 既存行のidが `examId:subtotalGroupId` へ振り直される
 * - @@unique が効き、同じ組み合わせの2行目を作れない
 * - 試験の削除でカスケード削除される（作り直しでFKが壊れていない）
 *
 * 手順は「本マイグレーションの1つ手前まで適用 → 旧形状のデータを投入 →
 * 本マイグレーションだけを適用」。
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createBaseline } from "../../electron-src/lib/prisma/schema/baselineMigrations"
import { bootstrapSchema } from "../../electron-src/lib/prisma/schema/schemaBootstrap"
import { createPrismaClientForPath } from "../helpers/testPrismaClient"

const TEST_ROOT = path.join(os.tmpdir(), "exam-subtotal-group-deterministic-id")
const DB_PATH = path.join(TEST_ROOT, "database.db")
const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations")
const TARGET_MIGRATION = "20260802040000_exam_subtotal_group_deterministic_id"

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

const OLD_ISO = "2026-07-01T00:00:00.000+00:00"
const NEW_ISO = "2026-07-02T00:00:00.000+00:00"

/**
 * 旧形状（uuid の id・unique 無し）のデータを投入する。
 * exam-1 × group-1 は重複2行。**古い方が false・新しい方が true** にしてあり、
 * 「最古の行の値をそのまま採る」実装だと選択が消えることを検知できる。
 */
function seedLegacyRows(db: SqliteDatabase): void {
  const run = (sql: string, params: unknown[]) => db.prepare(sql).run(params)

  run(
    `INSERT INTO "Exam" (id, examName, createdAt, updatedAt) VALUES (?,?,?,?)`,
    ["exam-1", "1学期期末", OLD_ISO, OLD_ISO]
  )
  run(
    `INSERT INTO "SubtotalGroup" (id, name, createdAt, updatedAt) VALUES (?,?,?,?)`,
    ["group-1", "大問別", OLD_ISO, OLD_ISO]
  )
  run(
    `INSERT INTO "SubtotalGroup" (id, name, createdAt, updatedAt) VALUES (?,?,?,?)`,
    ["group-2", "観点別", OLD_ISO, OLD_ISO]
  )

  for (const [id, groupId, selectedForTable, createdAt] of [
    ["uuid-old", "group-1", 0, OLD_ISO],
    ["uuid-new", "group-1", 1, NEW_ISO],
    ["uuid-other", "group-2", 0, OLD_ISO],
  ] as const) {
    run(
      `INSERT INTO "ExamSubtotalGroup" (id, examId, subtotalGroupId, selectedForTable, selectedForBoxPlot, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?)`,
      [id, "exam-1", groupId, selectedForTable, 0, createdAt, createdAt]
    )
  }
}

interface ExamSubtotalGroupRow {
  id: string
  subtotalGroupId: string
  selectedForTable: number
}

const readRows = (): ExamSubtotalGroupRow[] =>
  withDatabase(
    (db) =>
      db
        .prepare(
          `SELECT id, subtotalGroupId, selectedForTable
           FROM "ExamSubtotalGroup" ORDER BY subtotalGroupId ASC`
        )
        .all() as ExamSubtotalGroupRow[]
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

describe("試験と小計点グループの紐付けを決定論的idにする", () => {
  it("重複行が1件へ潰れ、フラグは重複行をまたいで OR される", async () => {
    // 新しい行にしか無い選択（selectedForTable=1）を捨てると、
    // 箱ひげ図・小計点テーブルの対象が予告なく外れる
    await migrate()

    const duplicated = readRows().filter(
      (row) => row.subtotalGroupId === "group-1"
    )
    expect(duplicated).toHaveLength(1)
    expect(duplicated[0].selectedForTable).toBe(1)
  })

  it("idが examId:subtotalGroupId へ振り直される", async () => {
    await migrate()

    expect(readRows().map((row) => row.id)).toEqual([
      "exam-1:group-1",
      "exam-1:group-2",
    ])
  })

  it("同じ組み合わせの2行目を作れない", async () => {
    await migrate()

    withDatabase((db) => {
      expect(() =>
        db
          .prepare(
            `INSERT INTO "ExamSubtotalGroup" (id, examId, subtotalGroupId, selectedForTable, selectedForBoxPlot, createdAt, updatedAt)
             VALUES (?,?,?,?,?,?,?)`
          )
          .run(["dup", "exam-1", "group-1", 0, 0, NEW_ISO, NEW_ISO])
      ).toThrow(/UNIQUE/)
    })
  })

  it("試験を消すとカスケード削除される（作り直しでFKが壊れていない）", async () => {
    await migrate()

    const definition = withDatabase(
      (db) =>
        db
          .prepare(
            `SELECT sql FROM sqlite_master WHERE type='table' AND name='ExamSubtotalGroup'`
          )
          .get() as { sql: string }
    )
    expect(definition.sql).toContain('REFERENCES "Exam" ("id")')

    const remaining = withDatabase((db) => {
      db.pragma("foreign_keys = ON")
      db.prepare(`DELETE FROM "Exam" WHERE id = 'exam-1'`).run()
      return db
        .prepare(`SELECT COUNT(*) AS count FROM "ExamSubtotalGroup"`)
        .get() as { count: number }
    })
    expect(remaining.count).toBe(0)
    expect(withDatabase((db) => db.pragma("foreign_key_check"))).toEqual([])
  })
})
