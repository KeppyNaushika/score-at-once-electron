/**
 * 20260729000000_rewire_coursework_score_to_coursework_student のデータ移行テスト
 *
 * 検証すること:
 * - 資料の対象者（CourseworkStudent）に紐づく点数が courseworkStudentId へ正しく付け替わる
 * - 対象者として登録されていない生徒の点数（孤児）は破棄される
 * - 破棄件数が AuditLog に記録される（0件のときは行を作らない）
 * - RENAME TO 後の FK 参照名が正しい
 *
 * 手順は「本マイグレーションの1つ手前まで適用 → 旧形状のデータを投入 →
 * 本マイグレーションだけを適用」。全マイグレーションを一括適用してしまうと
 * 旧形状のデータを差し込む隙が無くなるため、ここだけ手で刻む。
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createBaseline } from "../../electron-src/lib/prisma/schema/baselineMigrations"
import { bootstrapSchema } from "../../electron-src/lib/prisma/schema/schemaBootstrap"
import { createPrismaClientForPath } from "../helpers/testPrismaClient"

const TEST_ROOT = path.join(os.tmpdir(), "rewire-coursework-score")
const DB_PATH = path.join(TEST_ROOT, "database.db")
const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations")
const TARGET_MIGRATION =
  "20260729000000_rewire_coursework_score_to_coursework_student"

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

/** init ＋ 本マイグレーションの1つ手前までを適用した DB を用意する */
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

const ISO = "2026-07-01T00:00:00.000+00:00"

/**
 * 旧形状（点数が studentId 直結）のデータを投入する。
 * 対象者として登録するのは student-kept のみ。student-orphan は
 * 「資料から外されたのに点数だけ残った生徒」を表す。
 */
function seedLegacyData(db: SqliteDatabase): void {
  const run = (sql: string, params: unknown[]) => db.prepare(sql).run(params)

  run(
    `INSERT INTO "Coursework" (id, name, createdAt, updatedAt) VALUES (?,?,?,?)`,
    ["coursework-1", "第1回レポート", ISO, ISO]
  )
  run(
    `INSERT INTO "CourseworkItem" (id, courseworkId, name, "order", maxScore, inputMode, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?)`,
    ["item-1", "coursework-1", "提出物", 0, 100, "numeric", ISO, ISO]
  )

  for (const [studentId, studentNumber] of [
    ["student-kept", "S001"],
    ["student-orphan", "S002"],
  ]) {
    run(
      `INSERT INTO "Student" (id, studentNumber, lastName, firstName, lastNameKana, firstNameKana, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?)`,
      [studentId, studentNumber, "姓", "名", "セイ", "メイ", ISO, ISO]
    )
  }

  // 対象者として登録されているのは student-kept だけ
  run(
    `INSERT INTO "CourseworkStudent" (id, courseworkId, studentId, createdAt, updatedAt) VALUES (?,?,?,?,?)`,
    ["cwstudent-kept", "coursework-1", "student-kept", ISO, ISO]
  )

  for (const studentId of ["student-kept", "student-orphan"]) {
    run(
      `INSERT INTO "CourseworkScore" (id, courseworkItemId, studentId, score, adjustment, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?)`,
      [`cwscore-${studentId}`, "item-1", studentId, 85, 0, ISO, ISO]
    )
  }
}

const idsOf = (db: SqliteDatabase, table: string): string[] =>
  (
    db.prepare(`SELECT id FROM "${table}" ORDER BY id`).all() as {
      id: string
    }[]
  ).map((row) => row.id)

beforeEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(TEST_ROOT, { recursive: true })
})

afterEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe("資料の点数の CourseworkStudent 経由への配線変更マイグレーション", () => {
  it("対象者のある行は付け替わり、孤児は破棄され、件数が監査ログに残る", async () => {
    await buildDatabaseBeforeTargetMigration()
    withDatabase((db) => seedLegacyData(db))
    withDatabase((db) => applyMigration(db, TARGET_MIGRATION))

    withDatabase((db) => {
      expect(idsOf(db, "CourseworkScore")).toEqual(["cwscore-student-kept"])

      const score = db
        .prepare(
          `SELECT courseworkStudentId FROM "CourseworkScore" WHERE id = ?`
        )
        .get("cwscore-student-kept") as { courseworkStudentId: string }
      expect(score.courseworkStudentId).toBe("cwstudent-kept")

      // studentId 列は落ちている（CourseworkStudent から辿れるため）
      const columns = (
        db.prepare(`PRAGMA table_info("CourseworkScore")`).all() as {
          name: string
        }[]
      ).map((column) => column.name)
      expect(columns).not.toContain("studentId")
      expect(columns).toContain("courseworkStudentId")

      const auditLogs = db
        .prepare(
          `SELECT summary, metadata FROM "AuditLog" WHERE action = 'system.migration.cleanup_orphaned_scores'`
        )
        .all() as { summary: string; metadata: string }[]
      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0].summary).toContain("1 件")
      expect(JSON.parse(auditLogs[0].metadata)).toEqual({ courseworkScore: 1 })
    })
  })

  it("孤児が無ければ監査ログの行を作らない", async () => {
    await buildDatabaseBeforeTargetMigration()
    withDatabase((db) => {
      seedLegacyData(db)
      db.exec(
        `DELETE FROM "CourseworkScore" WHERE studentId = 'student-orphan'`
      )
    })
    withDatabase((db) => applyMigration(db, TARGET_MIGRATION))

    withDatabase((db) => {
      const count = db
        .prepare(
          `SELECT COUNT(*) AS n FROM "AuditLog" WHERE action = 'system.migration.cleanup_orphaned_scores'`
        )
        .get() as { n: number }
      expect(count.n).toBe(0)
      expect(idsOf(db, "CourseworkScore")).toEqual(["cwscore-student-kept"])
    })
  })

  it("差し替え後も FK 参照名が正しい（RENAME TO の取り違え防止）", async () => {
    await buildDatabaseBeforeTargetMigration()
    withDatabase((db) => seedLegacyData(db))
    withDatabase((db) => applyMigration(db, TARGET_MIGRATION))

    withDatabase((db) => {
      const definitions = new Map(
        (
          db
            .prepare(
              `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
            )
            .all() as { name: string; sql: string }[]
        ).map((row) => [row.name, row.sql])
      )

      for (const name of definitions.keys()) {
        expect(name.startsWith("new_")).toBe(false)
      }

      expect(definitions.get("CourseworkScore")).toContain(
        'REFERENCES "CourseworkStudent"'
      )
      expect(definitions.get("CourseworkScore")).toContain(
        'REFERENCES "CourseworkItem"'
      )
      expect(definitions.get("CourseworkScore")).not.toContain("new_")

      expect(db.prepare(`PRAGMA foreign_key_check`).all()).toEqual([])
    })
  })
})
