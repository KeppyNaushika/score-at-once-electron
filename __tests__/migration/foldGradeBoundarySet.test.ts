/**
 * 20260801000000_fold_grade_boundary_set_into_grade_item_boundary のデータ移行テスト
 *
 * 検証すること:
 * - 境界が親セットから gradeItemId を引き継いで GradeItemBoundary へ移る
 * - ラベル・閾値・並び順・作成日時が変わらない
 * - 境界を1本も持たない空セットは何も残さない（畳めば存在しないのと同じ）
 * - 容器（GradeBoundarySet）と旧テーブル（GradeBoundary）が消える
 * - 評価項目の削除で境界がカスケード削除される（FK が新テーブルへ正しく張られている）
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

const TEST_ROOT = path.join(os.tmpdir(), "fold-grade-boundary-set")
const DB_PATH = path.join(TEST_ROOT, "database.db")
const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations")
const TARGET_MIGRATION =
  "20260801000000_fold_grade_boundary_set_into_grade_item_boundary"

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
 * 旧形状（容器セットを挟む）のデータを投入する。
 * item-filled は境界2本を持つセット、item-empty は境界0本の空セットを持つ。
 * 空セットは upsert が境界を全消ししたときに残っていたもので、
 * 「境界は無いのに設定済み」と誤判定させていた実害そのもの。
 */
function seedLegacyBoundaries(db: SqliteDatabase): void {
  const run = (sql: string, params: unknown[]) => db.prepare(sql).run(params)

  run(`INSERT INTO "Grade" (id, name, createdAt, updatedAt) VALUES (?,?,?,?)`, [
    "grade-1",
    "1学期成績",
    ISO,
    ISO,
  ])
  for (const [gradeItemId, name, order] of [
    ["item-filled", "知識・技能", 0],
    ["item-empty", "思考・判断・表現", 1],
  ] as const) {
    run(
      `INSERT INTO "GradeItem" (id, gradeId, name, "order", createdAt, updatedAt) VALUES (?,?,?,?,?,?)`,
      [gradeItemId, "grade-1", name, order, ISO, ISO]
    )
    run(
      `INSERT INTO "GradeBoundarySet" (id, gradeId, gradeItemId, createdAt, updatedAt) VALUES (?,?,?,?,?)`,
      [`set-${gradeItemId}`, "grade-1", gradeItemId, ISO, ISO]
    )
  }

  for (const [label, minPercentage, order] of [
    ["A", 80, 0],
    ["B", 60, 1],
  ] as const) {
    run(
      `INSERT INTO "GradeBoundary" (id, gradeBoundarySetId, label, minPercentage, "order", createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?)`,
      [
        `boundary-${label}`,
        "set-item-filled",
        label,
        minPercentage,
        order,
        ISO,
        ISO,
      ]
    )
  }
}

beforeEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(TEST_ROOT, { recursive: true })
})

afterEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe("境界セットを畳んで評価項目へ直付けする", () => {
  it("境界が親セットの評価項目を引き継ぎ、内容も日時も変わらない", async () => {
    await buildDatabaseBeforeTargetMigration()
    withDatabase((db) => {
      seedLegacyBoundaries(db)
      applyMigration(db, TARGET_MIGRATION)
    })

    const boundaries = withDatabase(
      (db) =>
        db
          .prepare(
            `SELECT id, gradeItemId, label, minPercentage, "order", createdAt
             FROM "GradeItemBoundary" ORDER BY "order" ASC`
          )
          .all() as {
          id: string
          gradeItemId: string
          label: string
          minPercentage: number
          order: number
          createdAt: string
        }[]
    )

    expect(boundaries).toEqual([
      {
        id: "boundary-A",
        gradeItemId: "item-filled",
        label: "A",
        minPercentage: 80,
        order: 0,
        createdAt: ISO,
      },
      {
        id: "boundary-B",
        gradeItemId: "item-filled",
        label: "B",
        minPercentage: 60,
        order: 1,
        createdAt: ISO,
      },
    ])
  })

  it("境界0本の空セットは何も残さない（設定済みに見える状態が消える）", async () => {
    await buildDatabaseBeforeTargetMigration()
    withDatabase((db) => {
      seedLegacyBoundaries(db)
      applyMigration(db, TARGET_MIGRATION)
    })

    const emptyItemBoundaries = withDatabase((db) =>
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM "GradeItemBoundary" WHERE gradeItemId = 'item-empty'`
        )
        .get()
    ) as { count: number }

    expect(emptyItemBoundaries.count).toBe(0)
  })

  it("容器と旧テーブルがスキーマから消える", async () => {
    await buildDatabaseBeforeTargetMigration()
    withDatabase((db) => {
      seedLegacyBoundaries(db)
      applyMigration(db, TARGET_MIGRATION)
    })

    const tableNames = withDatabase((db) =>
      (
        db
          .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
          .all() as { name: string }[]
      ).map((row) => row.name)
    )

    expect(tableNames).not.toContain("GradeBoundarySet")
    expect(tableNames).not.toContain("GradeBoundary")
    expect(tableNames).toContain("GradeItemBoundary")
  })

  it("評価項目を消すと境界もカスケード削除される（FKが新テーブルへ張られている）", async () => {
    await buildDatabaseBeforeTargetMigration()
    const remaining = withDatabase((db) => {
      seedLegacyBoundaries(db)
      applyMigration(db, TARGET_MIGRATION)
      db.pragma("foreign_keys = ON")
      db.prepare(`DELETE FROM "GradeItem" WHERE id = 'item-filled'`).run()
      return db
        .prepare(`SELECT COUNT(*) AS count FROM "GradeItemBoundary"`)
        .get() as { count: number }
    })

    expect(remaining.count).toBe(0)
    expect(withDatabase((db) => db.pragma("foreign_key_check"))).toEqual([])
  })
})
