/**
 * 20260730000000_rewire_grade_cells_to_grade_student のデータ移行テスト
 *
 * 検証すること:
 * - 対象者（GradeStudent）に紐づく上書き・確定値・除外設定が gradeStudentId へ付け替わる
 * - 対象者として登録されていない生徒の行（孤児）は3種とも破棄される
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

const TEST_ROOT = path.join(os.tmpdir(), "rewire-grade-cells")
const DB_PATH = path.join(TEST_ROOT, "database.db")
const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations")
const TARGET_MIGRATION = "20260730000000_rewire_grade_cells_to_grade_student"
const AUDIT_ACTION = "system.migration.cleanup_orphaned_grade_cells"

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
 * 旧形状（(gradeId, studentId) で人を直に指す）のデータを投入する。
 * 対象者として登録するのは student-kept のみ。student-orphan は
 * 「成績から外されたのに設定だけ残った生徒」を表す。
 */
function seedLegacyData(db: SqliteDatabase): void {
  const run = (sql: string, params: unknown[]) => db.prepare(sql).run(params)

  run(`INSERT INTO "Grade" (id, name, createdAt, updatedAt) VALUES (?,?,?,?)`, [
    "grade-1",
    "1学期成績",
    ISO,
    ISO,
  ])
  run(
    `INSERT INTO "GradeItem" (id, gradeId, name, "order", createdAt, updatedAt) VALUES (?,?,?,?,?,?)`,
    ["item-1", "grade-1", "知識・技能", 0, ISO, ISO]
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
    `INSERT INTO "GradeStudent" (id, gradeId, studentId, createdAt, updatedAt) VALUES (?,?,?,?,?)`,
    ["gradestudent-kept", "grade-1", "student-kept", ISO, ISO]
  )

  for (const studentId of ["student-kept", "student-orphan"]) {
    run(
      `INSERT INTO "GradeOverride" (id, gradeId, studentId, gradeItemId, overrideLabel, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?)`,
      [`override-${studentId}`, "grade-1", studentId, "item-1", "A", ISO, ISO]
    )
    run(
      `INSERT INTO "GradeFrozenScore" (id, gradeId, studentId, gradeItemId, weightedScore, weightedMaxScore, percentage, gradeLabel, frozenAt, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        `frozen-${studentId}`,
        "grade-1",
        studentId,
        "item-1",
        0.8,
        1,
        80,
        "A",
        ISO,
        ISO,
        ISO,
      ]
    )
    run(
      `INSERT INTO "GradeItemExclusion" (id, gradeId, studentId, gradeItemId, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?)`,
      [`exclusion-${studentId}`, "grade-1", studentId, "item-1", ISO, ISO]
    )
  }
}

const idsOf = (db: SqliteDatabase, table: string): string[] =>
  (
    db.prepare(`SELECT id FROM "${table}" ORDER BY id`).all() as {
      id: string
    }[]
  ).map((row) => row.id)

const columnsOf = (db: SqliteDatabase, table: string): string[] =>
  (db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map(
    (column) => column.name
  )

const CELL_TABLES = ["GradeOverride", "GradeFrozenScore", "GradeItemExclusion"]

beforeEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(TEST_ROOT, { recursive: true })
})

afterEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe("成績のセルの GradeStudent 経由への配線変更マイグレーション", () => {
  it("対象者のある行は付け替わり、孤児は破棄され、件数が監査ログに残る", async () => {
    await buildDatabaseBeforeTargetMigration()
    withDatabase((db) => seedLegacyData(db))
    withDatabase((db) => applyMigration(db, TARGET_MIGRATION))

    withDatabase((db) => {
      expect(idsOf(db, "GradeOverride")).toEqual(["override-student-kept"])
      expect(idsOf(db, "GradeFrozenScore")).toEqual(["frozen-student-kept"])
      expect(idsOf(db, "GradeItemExclusion")).toEqual([
        "exclusion-student-kept",
      ])

      for (const table of CELL_TABLES) {
        const row = db
          .prepare(`SELECT gradeStudentId FROM "${table}"`)
          .get() as { gradeStudentId: string }
        expect(row.gradeStudentId).toBe("gradestudent-kept")

        // gradeId / studentId 列は落ちている（GradeStudent から辿れるため）
        const columns = columnsOf(db, table)
        expect(columns).not.toContain("studentId")
        expect(columns).not.toContain("gradeId")
        expect(columns).toContain("gradeStudentId")
      }

      // 確定値の中身が失われていないこと
      const frozen = db
        .prepare(
          `SELECT weightedScore, weightedMaxScore, percentage, gradeLabel FROM "GradeFrozenScore"`
        )
        .get() as {
        weightedScore: number
        weightedMaxScore: number
        percentage: number
        gradeLabel: string
      }
      expect(frozen).toMatchObject({
        weightedScore: 0.8,
        weightedMaxScore: 1,
        percentage: 80,
        gradeLabel: "A",
      })

      const auditLogs = db
        .prepare(`SELECT summary, metadata FROM "AuditLog" WHERE action = ?`)
        .all(AUDIT_ACTION) as { summary: string; metadata: string }[]
      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0].summary).toContain("3 件")
      expect(JSON.parse(auditLogs[0].metadata)).toEqual({
        gradeOverride: 1,
        gradeFrozenScore: 1,
        gradeItemExclusion: 1,
      })
    })
  })

  it("孤児が無ければ監査ログの行を作らない", async () => {
    await buildDatabaseBeforeTargetMigration()
    withDatabase((db) => {
      seedLegacyData(db)
      for (const table of CELL_TABLES) {
        db.exec(`DELETE FROM "${table}" WHERE studentId = 'student-orphan'`)
      }
    })
    withDatabase((db) => applyMigration(db, TARGET_MIGRATION))

    withDatabase((db) => {
      const count = db
        .prepare(`SELECT COUNT(*) AS n FROM "AuditLog" WHERE action = ?`)
        .get(AUDIT_ACTION) as { n: number }
      expect(count.n).toBe(0)
      expect(idsOf(db, "GradeOverride")).toEqual(["override-student-kept"])
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

      for (const table of CELL_TABLES) {
        expect(definitions.get(table)).toContain('REFERENCES "GradeStudent"')
        expect(definitions.get(table)).toContain('REFERENCES "GradeItem"')
        expect(definitions.get(table)).not.toContain("new_")
      }
      // 確定操作者は SetNull のまま残る
      expect(definitions.get("GradeFrozenScore")).toContain('REFERENCES "User"')

      expect(db.prepare(`PRAGMA foreign_key_check`).all()).toEqual([])
    })
  })
})
