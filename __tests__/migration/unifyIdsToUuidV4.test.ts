/**
 * 20260803110000_unify_ids_to_uuidv4 のデータ移行テスト
 *
 * 導出idを uuidv4 へ振り直す。対象の id は3系統ある。
 *   (a) 合成id `親id:子キー`             … ExamSubtotalGroup / GradeConstraint* / GradeDataSourceEstimationSource
 *   (b) 親の id をそのまま主キーにした行  … ExamIndividualReportSettings / …GraphSettings
 *   (c) uuidv5（内容の sha1 から導出）    … CropRegionAssignment
 *
 * 検証すること:
 * - 3系統とも uuidv4（15文字目が '4'、バリアントが 8/9/a/b）へ振り直される
 * - 既に v4 の行は**触られない**（再適用で収束済みの行を壊さない）
 * - 行ごとに異なる id が振られる（randomblob が行単位で評価される）
 * - `updatedAt` が更新される。**据え置くと端末間で同時刻タイになり恒久分岐する**ため必須
 * - 外部キーが壊れない
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

const TEST_ROOT = path.join(os.tmpdir(), "unify-ids-to-uuidv4")
const DB_PATH = path.join(TEST_ROOT, "database.db")
const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations")
const TARGET_MIGRATION = "20260803110000_unify_ids_to_uuidv4"

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

const ISO = "2026-07-01T00:00:00.000+00:00"
/** 既に uuidv4 の行。移行で触られてはいけない */
const ALREADY_V4 = "71fb5dcd-8404-40cd-bc34-be8abd9e861e"
/** uuidv5（15文字目が '5'） */
const V5_ID = "cdae0d9d-bdc1-564d-98a4-1f2db8e40f77"

const isUuidV4 = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    value
  )

function seedLegacyRows(db: SqliteDatabase): void {
  insertWithDefaults(db, "Exam", {
    id: "exam-1",
    examName: "1学期期末",
    createdAt: ISO,
    updatedAt: ISO,
  })
  for (const groupId of ["group-1", "group-2"]) {
    insertWithDefaults(db, "SubtotalGroup", {
      id: groupId,
      name: groupId,
      createdAt: ISO,
      updatedAt: ISO,
    })
  }

  // (a) 合成id 2件
  for (const [id, groupId] of [
    ["exam-1:group-1", "group-1"],
    ["exam-1:group-2", "group-2"],
  ] as const) {
    insertWithDefaults(db, "ExamSubtotalGroup", {
      id,
      examId: "exam-1",
      subtotalGroupId: groupId,
      createdAt: ISO,
      updatedAt: ISO,
    })
  }

  // (b) 親の id をそのまま主キーにした行。
  // この表は列が多く、しかも増えていくので、NOT NULL 列を自動で埋める
  insertWithDefaults(db, "ExamIndividualReportSettings", {
    id: "exam-1",
    examId: "exam-1",
    createdAt: ISO,
    updatedAt: ISO,
  })
}

/** @internal `PRAGMA table_info` が返すカラム情報 */
interface ColumnInfo {
  name: string
  type: string
  notnull: number
  dflt_value: unknown
}

/**
 * 指定した値以外の NOT NULL 列を、型に応じた既定値で埋めて1行入れる。
 * 出力設定の表は列が多く、テストが列の増減で壊れるのを避ける。
 */
function insertWithDefaults(
  db: SqliteDatabase,
  table: string,
  values: Record<string, string | number>
): void {
  const columns = db
    .prepare(`PRAGMA table_info("${table}")`)
    .all() as ColumnInfo[]
  const row: Record<string, string | number> = { ...values }
  for (const column of columns) {
    if (column.name in row) continue
    if (column.notnull === 0 || column.dflt_value !== null) continue
    row[column.name] = /INT|REAL|DECIMAL|NUM/i.test(column.type) ? 0 : ""
  }
  const names = Object.keys(row)
  db.prepare(
    `INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(", ")})
     VALUES (${names.map(() => "?").join(", ")})`
  ).run(names.map((n) => row[n]))
}

interface IdRow {
  id: string
  updatedAt: string
}

describe("20260803110000_unify_ids_to_uuidv4", () => {
  beforeEach(async () => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true })
    fs.mkdirSync(TEST_ROOT, { recursive: true })
    await buildDatabaseBeforeTargetMigration()
  })

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  })

  it("合成id・借用id・uuidv5 を uuidv4 へ振り直し、既に v4 の行は触らない", () => {
    withDatabase((db) => {
      seedLegacyRows(db)
      // 既に v4 の行（触られないことの確認用）。@@unique を避けて別の組にする
      insertWithDefaults(db, "SubtotalGroup", {
        id: "group-3",
        name: "group-3",
        createdAt: ISO,
        updatedAt: ISO,
      })
      insertWithDefaults(db, "ExamSubtotalGroup", {
        id: ALREADY_V4,
        examId: "exam-1",
        subtotalGroupId: "group-3",
        createdAt: ISO,
        updatedAt: ISO,
      })
    })

    withDatabase((db) => applyMigration(db, TARGET_MIGRATION))

    withDatabase((db) => {
      const links = db
        .prepare(`SELECT id, updatedAt FROM "ExamSubtotalGroup"`)
        .all() as IdRow[]
      expect(links).toHaveLength(3)

      // 既に v4 の行は id も updatedAt も変わらない
      const untouched = links.find((row) => row.id === ALREADY_V4)
      expect(untouched).toBeDefined()
      expect(untouched!.updatedAt).toBe(ISO)

      // 残り2件は v4 へ振り直され、updatedAt も更新されている
      const rewritten = links.filter((row) => row.id !== ALREADY_V4)
      expect(rewritten).toHaveLength(2)
      for (const row of rewritten) {
        expect(isUuidV4(row.id)).toBe(true)
        expect(row.updatedAt).not.toBe(ISO)
      }
      // 行ごとに別の id（randomblob が行単位で評価されている）
      expect(new Set(rewritten.map((row) => row.id)).size).toBe(2)

      // (b) 親の id を借りていた行
      const report = db
        .prepare(
          `SELECT id, examId, updatedAt FROM "ExamIndividualReportSettings"`
        )
        .get() as IdRow & { examId: string }
      expect(isUuidV4(report.id)).toBe(true)
      expect(report.id).not.toBe(report.examId)
      expect(report.examId).toBe("exam-1")
      expect(report.updatedAt).not.toBe(ISO)

      expect(db.prepare(`PRAGMA foreign_key_check`).all()).toEqual([])
    })
  })

  it("uuidv5 の行が uuidv4 へ振り直される", () => {
    withDatabase((db) => {
      seedLegacyRows(db)
      insertWithDefaults(db, "User", {
        id: "user-1",
        username: "teacher",
        createdAt: ISO,
        updatedAt: ISO,
      })
      insertWithDefaults(db, "ExamPage", {
        id: "page-1",
        examId: "exam-1",
        pageNumber: 1,
        createdAt: ISO,
        updatedAt: ISO,
      })
      insertWithDefaults(db, "CropRegion", {
        id: "region-1",
        examPageId: "page-1",
        type: "QUESTION_ANSWER",
        createdAt: ISO,
        updatedAt: ISO,
      })
      insertWithDefaults(db, "CropRegionAssignment", {
        id: V5_ID,
        cropRegionId: "region-1",
        userId: "user-1",
        createdAt: ISO,
        updatedAt: ISO,
      })
    })

    withDatabase((db) => applyMigration(db, TARGET_MIGRATION))

    withDatabase((db) => {
      const assignment = db
        .prepare(`SELECT id, updatedAt FROM "CropRegionAssignment"`)
        .get() as IdRow
      expect(assignment.id).not.toBe(V5_ID)
      expect(isUuidV4(assignment.id)).toBe(true)
      expect(assignment.updatedAt).not.toBe(ISO)
      expect(db.prepare(`PRAGMA foreign_key_check`).all()).toEqual([])
    })
  })

  it("再適用しても振り直し済みの行は変わらない（冪等）", () => {
    withDatabase((db) => seedLegacyRows(db))
    withDatabase((db) => applyMigration(db, TARGET_MIGRATION))

    const afterFirst = withDatabase(
      (db) =>
        db
          .prepare(`SELECT id, updatedAt FROM "ExamSubtotalGroup" ORDER BY id`)
          .all() as IdRow[]
    )
    withDatabase((db) => applyMigration(db, TARGET_MIGRATION))
    const afterSecond = withDatabase(
      (db) =>
        db
          .prepare(`SELECT id, updatedAt FROM "ExamSubtotalGroup" ORDER BY id`)
          .all() as IdRow[]
    )

    expect(afterSecond).toEqual(afterFirst)
  })
})
