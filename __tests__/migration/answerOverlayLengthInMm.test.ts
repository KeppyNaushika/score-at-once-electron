/**
 * 20261011100000_answer_overlay_length_in_mm のテスト
 *
 * 検証すること:
 * - 既存の行は lengthUnit = "px" になり、値・id・時刻は変わらない（mm への変換はアプリが JS で行う）
 * - 長さの列が REAL になり、小数を持てる
 * - 新しい行の既定は "mm"
 *
 * 手順は「本マイグレーションの1つ手前まで適用 → 旧形状の行を投入 → 本マイグレーションだけを適用」。
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createBaseline } from "../../electron-src/lib/prisma/schema/baselineMigrations"
import { bootstrapSchema } from "../../electron-src/lib/prisma/schema/schemaBootstrap"
import { createPrismaClientForPath } from "../helpers/testPrismaClient"

const TEST_ROOT = path.join(os.tmpdir(), "answer-overlay-length-in-mm")
const DB_PATH = path.join(TEST_ROOT, "database.db")
const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations")
const TARGET_MIGRATION = "20261011100000_answer_overlay_length_in_mm"

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

const CREATED_AT = "2026-07-01T00:00:00.000+00:00"
const UPDATED_AT = "2026-08-02T03:04:05.000+00:00"

interface StyleRow {
  id: string
  lengthUnit: string
  offsetX: number
  offsetY: number
  size: number
  createdAt: string
  updatedAt: string
}

describe(TARGET_MIGRATION, () => {
  beforeEach(async () => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true })
    fs.mkdirSync(TEST_ROOT, { recursive: true })
    await buildDatabaseBeforeTargetMigration()
  })

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  })

  it("既存の行は px の印を付け、値・id・時刻を変えない。新しい行の既定は mm", () => {
    withDatabase((db) => {
      db.pragma("foreign_keys = OFF")
      db.prepare(
        `INSERT INTO "ExamAnswerOverlayStyle" ("id", "examId", "overlayKind", "position", "anchor", "offsetX", "offsetY", "size", "color", "opacity", "createdAt", "updatedAt")
         VALUES ('style-1', 'exam-1', 'mark', 'top-left', 'top-left', 3, -4, 50, '#ef4444', 100, ?, ?)`
      ).run(CREATED_AT, UPDATED_AT)

      applyMigration(db, TARGET_MIGRATION)

      expect(
        db
          .prepare<[], StyleRow>(
            `SELECT "id", "lengthUnit", "offsetX", "offsetY", "size", "createdAt", "updatedAt" FROM "ExamAnswerOverlayStyle"`
          )
          .all()
      ).toEqual([
        {
          id: "style-1",
          lengthUnit: "px",
          offsetX: 3,
          offsetY: -4,
          size: 50,
          createdAt: CREATED_AT,
          updatedAt: UPDATED_AT,
        },
      ])

      // 長さの列は REAL（小数を持てる）。新しい行は既定で mm
      const columnTypes = Object.fromEntries(
        db
          .prepare<[], { name: string; type: string }>(
            `SELECT name, type FROM pragma_table_info('ExamAnswerOverlayStyle')`
          )
          .all()
          .map((column) => [column.name, column.type])
      )
      expect(columnTypes).toMatchObject({
        offsetX: "REAL",
        offsetY: "REAL",
        size: "REAL",
        lengthUnit: "TEXT",
      })
      // migration の末尾が外部キーの検査を戻すので、親の無い行を入れる前にもう一度切る
      db.pragma("foreign_keys = OFF")
      db.prepare(
        `INSERT INTO "ExamAnswerOverlayStyle" ("id", "examId", "overlayKind", "position", "anchor", "offsetX", "offsetY", "size", "color", "opacity")
         VALUES ('style-2', 'exam-1', 'partial', 'middle-center', 'middle-center', 0.5, -1.25, 2.5, '#ef4444', 100)`
      ).run()
      expect(
        db
          .prepare<[], Pick<StyleRow, "lengthUnit" | "offsetY" | "size">>(
            `SELECT "lengthUnit", "offsetY", "size" FROM "ExamAnswerOverlayStyle" WHERE "id" = 'style-2'`
          )
          .get()
      ).toEqual({ lengthUnit: "mm", offsetY: -1.25, size: 2.5 })
    })
  })
})
