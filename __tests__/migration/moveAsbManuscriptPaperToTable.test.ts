/**
 * 20260821000000_move_asb_manuscript_paper_to_table のデータ移行テスト
 *
 * 検証すること:
 * - 使っている小問（有効／設定が既定と違う／マーカーを持つ）が AsbManuscriptPaper へ移る
 * - 値（列数・行数・ガイド設定）が変わらない
 * - **既定のまま一度も使っていない小問には行を作らない**（行の不在が「未使用」を表す）
 * - 文字位置マーカーの親が原稿用紙へ付け替わり、id と値は据え置き
 * - 原稿用紙の id が uuidv4（親の id を借りない）
 * - 小問から原稿用紙の7列が消える
 * - 小問を消すと原稿用紙とマーカーがカスケードで消える（FK が正しく張られている）
 *
 * 手順は「本マイグレーションの1つ手前まで適用 → 旧形状のデータを投入 →
 * 本マイグレーションだけを適用」。全マイグレーションを一括適用すると旧形状の
 * データを差し込む隙が無くなるため、ここだけ手で刻む。
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createBaseline } from "../../electron-src/lib/prisma/schema/baselineMigrations"
import { bootstrapSchema } from "../../electron-src/lib/prisma/schema/schemaBootstrap"
import { createPrismaClientForPath } from "../helpers/testPrismaClient"

const TEST_ROOT = path.join(os.tmpdir(), "move-asb-manuscript-paper")
const DB_PATH = path.join(TEST_ROOT, "database.db")
const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations")
const TARGET_MIGRATION = "20260821000000_move_asb_manuscript_paper_to_table"

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

const ISO = "2026-08-01T00:00:00.000+00:00"

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

interface LegacySubQuestion {
  id: string
  manuscriptEnabled: number
  manuscriptColumns: number
  manuscriptRows: number
  manuscriptGuideFontSize: number | null
  manuscriptGuidePosition: string | null
  manuscriptGuidePadding: number | null
}

/**
 * 旧形状（原稿用紙が小問の列）のデータを投入する。
 *
 * - sub-used: 有効・25×15・ガイド設定つき・マーカー2件
 * - sub-off: 無効だが 30×5 と既定から動かしてある（オフにして保管している姿）
 * - sub-guides-only: 設定は既定のままだがマーカーを持つ
 * - sub-untouched: 一度も触っていない（行が作られてはいけない）
 */
function seedLegacyManuscriptPapers(db: SqliteDatabase): void {
  const run = (sql: string, params: unknown[]) => db.prepare(sql).run(params)

  run(
    `INSERT INTO "User" (id, username, name, role, passcodeType, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)`,
    ["user-1", "teacher-1", "教員", "teacher", "none", ISO, ISO]
  )
  run(
    `INSERT INTO "AsbDefinition" (id, name, userId, createdAt, updatedAt) VALUES (?,?,?,?,?)`,
    ["def-1", "解答用紙", "user-1", ISO, ISO]
  )
  run(
    `INSERT INTO "AsbMajorQuestion" (id, definitionId, label, "order", createdAt, updatedAt) VALUES (?,?,?,?,?,?)`,
    ["major-1", "def-1", "1", 0, ISO, ISO]
  )

  const subQuestions: LegacySubQuestion[] = [
    {
      id: "sub-used",
      manuscriptEnabled: 1,
      manuscriptColumns: 25,
      manuscriptRows: 15,
      manuscriptGuideFontSize: 0.4,
      manuscriptGuidePosition: "top-right",
      manuscriptGuidePadding: 0.1,
    },
    {
      id: "sub-off",
      manuscriptEnabled: 0,
      manuscriptColumns: 30,
      manuscriptRows: 5,
      manuscriptGuideFontSize: null,
      manuscriptGuidePosition: null,
      manuscriptGuidePadding: null,
    },
    {
      id: "sub-guides-only",
      manuscriptEnabled: 0,
      manuscriptColumns: 20,
      manuscriptRows: 10,
      manuscriptGuideFontSize: null,
      manuscriptGuidePosition: null,
      manuscriptGuidePadding: null,
    },
    {
      id: "sub-untouched",
      manuscriptEnabled: 0,
      manuscriptColumns: 20,
      manuscriptRows: 10,
      manuscriptGuideFontSize: null,
      manuscriptGuidePosition: null,
      manuscriptGuidePadding: null,
    },
  ]

  for (const [order, subQuestion] of subQuestions.entries()) {
    run(
      `INSERT INTO "AsbSubQuestion" (id, majorQuestionId, label, "order", heightMultiplier, points,
         manuscriptEnabled, manuscriptColumns, manuscriptRows, manuscriptCellSizeMm,
         manuscriptGuideFontSize, manuscriptGuidePosition, manuscriptGuidePadding, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        subQuestion.id,
        "major-1",
        subQuestion.id,
        order,
        1,
        1,
        subQuestion.manuscriptEnabled,
        subQuestion.manuscriptColumns,
        subQuestion.manuscriptRows,
        0,
        subQuestion.manuscriptGuideFontSize,
        subQuestion.manuscriptGuidePosition,
        subQuestion.manuscriptGuidePadding,
        ISO,
        ISO,
      ]
    )
  }

  for (const [charGuideId, subQuestionId, atChar, label] of [
    ["guide-a", "sub-used", 80, "80"],
    ["guide-b", "sub-used", 100, "100"],
    ["guide-c", "sub-guides-only", 40, "40"],
  ] as const) {
    run(
      `INSERT INTO "AsbCharGuide" (id, subQuestionId, "order", atChar, label, boundary, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?)`,
      [charGuideId, subQuestionId, 0, atChar, label, "dashed", ISO, ISO]
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

interface ManuscriptPaperRow {
  id: string
  subQuestionId: string | null
  branchQuestionId: string | null
  enabled: number
  columns: number
  rows: number
  guideFontSize: number | null
  guidePosition: string | null
  guidePadding: number | null
}

const manuscriptPaperRows = (): ManuscriptPaperRow[] =>
  withDatabase(
    (db) =>
      db
        .prepare(`SELECT * FROM "AsbManuscriptPaper" ORDER BY "subQuestionId"`)
        .all() as ManuscriptPaperRow[]
  )

describe("原稿用紙をテーブルへ出すマイグレーション", () => {
  beforeEach(async () => {
    await buildDatabaseBeforeTargetMigration()
    withDatabase((db) => {
      seedLegacyManuscriptPapers(db)
      applyMigration(db, TARGET_MIGRATION)
    })
  })

  it("使っている小問だけが行になり、値は変わらない", () => {
    const rows = manuscriptPaperRows()

    expect(rows.map((row) => row.subQuestionId)).toEqual([
      "sub-guides-only",
      "sub-off",
      "sub-used",
    ])

    const used = rows.find((row) => row.subQuestionId === "sub-used")
    expect(used).toMatchObject({
      branchQuestionId: null,
      enabled: 1,
      columns: 25,
      rows: 15,
      guideFontSize: 0.4,
      guidePosition: "top-right",
      guidePadding: 0.1,
    })

    // オフでも設定は保管される（「行なし＝一度も使っていない」と読むため）
    const off = rows.find((row) => row.subQuestionId === "sub-off")
    expect(off).toMatchObject({ enabled: 0, columns: 30, rows: 5 })
  })

  it("既定のまま一度も使っていない小問には行を作らない", () => {
    expect(manuscriptPaperRows().map((row) => row.subQuestionId)).not.toContain(
      "sub-untouched"
    )
  })

  it("原稿用紙の id は uuidv4（親の id を借りない）", () => {
    for (const row of manuscriptPaperRows()) {
      expect(row.id).toMatch(UUID_V4)
      expect(row.id).not.toBe(row.subQuestionId)
    }
  })

  it("文字位置マーカーの親が原稿用紙へ移り、id と値は据え置き", () => {
    const paperBySubQuestionId = new Map(
      manuscriptPaperRows().map((row) => [row.subQuestionId, row.id])
    )
    const charGuides = withDatabase(
      (db) =>
        db.prepare(`SELECT * FROM "AsbCharGuide" ORDER BY "id"`).all() as {
          id: string
          manuscriptPaperId: string
          atChar: number
          label: string
          boundary: string | null
        }[]
    )

    expect(charGuides.map((charGuide) => charGuide.id)).toEqual([
      "guide-a",
      "guide-b",
      "guide-c",
    ])
    expect(charGuides.map((charGuide) => charGuide.atChar)).toEqual([
      80, 100, 40,
    ])
    expect(charGuides.map((charGuide) => charGuide.boundary)).toEqual([
      "dashed",
      "dashed",
      "dashed",
    ])
    expect(charGuides[0].manuscriptPaperId).toBe(
      paperBySubQuestionId.get("sub-used")
    )
    expect(charGuides[2].manuscriptPaperId).toBe(
      paperBySubQuestionId.get("sub-guides-only")
    )
  })

  it("小問から原稿用紙の列が消える", () => {
    const columns = withDatabase(
      (db) =>
        db.prepare(`PRAGMA table_info("AsbSubQuestion")`).all() as {
          name: string
        }[]
    ).map((column) => column.name)

    for (const removed of [
      "manuscriptEnabled",
      "manuscriptColumns",
      "manuscriptRows",
      "manuscriptCellSizeMm",
      "manuscriptGuideFontSize",
      "manuscriptGuidePosition",
      "manuscriptGuidePadding",
    ]) {
      expect(columns).not.toContain(removed)
    }
    // 巻き添えで落ちていないこと
    expect(columns).toContain("layoutWidth")
    expect(columns).toContain("usesBranchPoints")
  })

  it("小問を消すと原稿用紙とマーカーがカスケードで消える", () => {
    withDatabase((db) => {
      db.pragma("foreign_keys = ON")
      db.prepare(`DELETE FROM "AsbSubQuestion" WHERE id = ?`).run("sub-used")
      const papers = db
        .prepare(`SELECT COUNT(*) AS count FROM "AsbManuscriptPaper"`)
        .get() as { count: number }
      const charGuides = db
        .prepare(`SELECT COUNT(*) AS count FROM "AsbCharGuide"`)
        .get() as { count: number }
      // 残るのは sub-off と sub-guides-only の2行、マーカーは guide-c だけ
      expect(papers.count).toBe(2)
      expect(charGuides.count).toBe(1)
    })
  })
})
