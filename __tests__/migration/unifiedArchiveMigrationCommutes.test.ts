/**
 * migration が「一部だけの DB」でも全体と同じ結果になること（docs/unified-archive-design.md §8）
 *
 * 統合アーカイブ（.sao）は、選んだ範囲だけを詰めた DB を書き出し、取り込むときにアプリと
 * 同じ migration を当てて現行化する。固定データ（`__tests__/fixtures/unifiedArchiveBaseline.sql`）
 * より後に足された migration を、全体の DB と一部だけの DB の両方に当てて突き合わせる。
 * 食い違ったら、その migration は §8 の規約（範囲の内側だけを参照する・参照先が無いときは
 * 元の値を保つ・行を作るのは一意制約を持つ表だけ）を破っている。
 *
 * 固定データは、本番と同じ新規インストールの経路（init → ベースライン → 全 migration）で作った
 * DB に合成データを入れたもの。作り直すときは `UPDATE_UNIFIED_ARCHIVE_BASELINE=1` を付けて
 * このファイルを走らせる。作り直すと、それまでに足された migration はこの検査の対象から外れる。
 */

import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ArchiveSelection } from "../../electron-src/lib/export/unified-archive/archiveScopeResolver"
import { createBaseline } from "../../electron-src/lib/prisma/schema/baselineMigrations"
import { deployPendingMigrations } from "../../electron-src/lib/prisma/schema/migrationDeployer"
import { bootstrapSchema } from "../../electron-src/lib/prisma/schema/schemaBootstrap"
import {
  checkMigrationsCommute,
  createDatabaseFromDump,
  type MigrationSource,
  pendingMigrations,
} from "../helpers/migrationCommutation"
import { dumpDatabase } from "../helpers/sqliteDump"
import { createPrismaClientForPath } from "../helpers/testPrismaClient"
import { createUnifiedArchiveFixture } from "../helpers/unifiedArchiveFixture"

const WORK_DIR = path.join(os.tmpdir(), "unified-archive-commutes")
const DB_PATH = path.join(WORK_DIR, "database.db")
const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations")
const BASELINE_PATH = path.resolve(
  __dirname,
  "../fixtures/unifiedArchiveBaseline.sql"
)

// deployPendingMigrations は接続先を getDatabasePath() で決めるため、作業用の DB へ向ける
vi.mock("../../electron-src/lib/prisma/databaseInitializer", () => ({
  getDatabasePath: () => DB_PATH,
}))

/** 固定データに入っている id（範囲の起点に使う）。固定データを作り直したら合わせる */
interface BaselineRoots {
  examId: string
  gradeId: string
  scorerUserId: string
}

const readBaselineRoots = (): BaselineRoots => {
  createDatabaseFromDump(DB_PATH, fs.readFileSync(BASELINE_PATH, "utf-8"))
  const db = new Database(DB_PATH, { readonly: true })
  try {
    const exam = db
      .prepare<[], { id: string }>(
        `SELECT id FROM "Exam" WHERE "examName" = '試験A'`
      )
      .get()
    const grade = db
      .prepare<[], { id: string }>(
        `SELECT id FROM "Grade" WHERE name = '後学期'`
      )
      .get()
    const scorer = db
      .prepare<[string], { userId: string }>(
        `SELECT "userId" FROM "UserExam" WHERE "examId" = ?`
      )
      .get(exam?.id ?? "")
    if (!exam || !grade || !scorer) {
      throw new Error("固定データに起点の行がありません")
    }
    return { examId: exam.id, gradeId: grade.id, scorerUserId: scorer.userId }
  } finally {
    db.close()
  }
}

/** 試験1件・成績算出（使う試験・資料・比較先を含む）・本人分＋利用者設定、の3つの範囲 */
const selectionsOf = (roots: BaselineRoots): ArchiveSelection[] => [
  { roots: { Exam: [roots.examId] } },
  { roots: { Grade: [roots.gradeId] } },
  {
    roots: { Exam: [roots.examId] },
    scoring: { kind: "self", userId: roots.scorerUserId },
    optionalItems: ["userSettings"],
  },
]

beforeEach(() => {
  fs.rmSync(WORK_DIR, { recursive: true, force: true })
  fs.mkdirSync(WORK_DIR, { recursive: true })
})

afterEach(() => {
  fs.rmSync(WORK_DIR, { recursive: true, force: true })
})

describe("migration は一部だけの DB でも全体と同じ結果になる", () => {
  it.skipIf(!process.env.UPDATE_UNIFIED_ARCHIVE_BASELINE)(
    "固定データを作り直す",
    async () => {
      bootstrapSchema(DB_PATH)
      const prisma = createPrismaClientForPath(DB_PATH)
      try {
        await createBaseline(prisma)
        deployPendingMigrations({ migrationsDir: MIGRATIONS_DIR })
        await createUnifiedArchiveFixture(prisma)
      } finally {
        await prisma.$disconnect()
      }
      const db = new Database(DB_PATH, { readonly: true })
      try {
        fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true })
        fs.writeFileSync(BASELINE_PATH, dumpDatabase(db))
      } finally {
        db.close()
      }
    },
    60_000
  )

  it("固定データより後に足された migration が、どの範囲でも食い違わない", () => {
    const baselineSql = fs.readFileSync(BASELINE_PATH, "utf-8")
    const roots = readBaselineRoots()
    const baselineDb = new Database(DB_PATH, { readonly: true })
    let migrations: MigrationSource[]
    try {
      migrations = pendingMigrations(baselineDb, MIGRATIONS_DIR)
    } finally {
      baselineDb.close()
    }

    const differences = checkMigrationsCommute({
      baselineSql,
      migrations,
      selections: selectionsOf(roots),
      workDir: WORK_DIR,
    })
    expect(differences).toEqual([])
  })

  // ── 検査器そのものが効いていることの保証 ─────────────────────────
  // 実際に検査する migration がまだ無いと、上の検査は空のまま通る。わざと作った
  // 良い例・悪い例で、検査器が食い違いを見つけ、見つけるべきでないものを見逃すことを確かめる

  const check = (sql: string): string[] => {
    const baselineSql = fs.readFileSync(BASELINE_PATH, "utf-8")
    return checkMigrationsCommute({
      baselineSql,
      migrations: [{ name: "99999999999999_synthetic", sql }],
      selections: selectionsOf(readBaselineRoots()),
      workDir: WORK_DIR,
    })
  }

  it("範囲の内側（同じページの兄弟）だけを数える migration は通る", () => {
    expect(
      check(`UPDATE "CropRegion" SET "label" = "label" || (
        SELECT COUNT(*) FROM "CropRegion" AS sibling
        WHERE sibling."examPageId" = "CropRegion"."examPageId")`)
    ).toEqual([])
  })

  it("範囲の外まで数える migration は食い違う", () => {
    expect(
      check(`UPDATE "Exam" SET "examName" = (SELECT COUNT(*) FROM "Exam")`)
    ).not.toEqual([])
  })

  it("一意制約を持つ表に乱数の id で行を作る migration は通る", () => {
    expect(
      check(`INSERT INTO "ExamAnswerOverlayVisibility"
          ("id", "examId", "status", "showMark", "showScore", "createdAt", "updatedAt")
        SELECT lower(hex(randomblob(16))), "id", 'synthetic', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM "Exam"`)
    ).toEqual([])
  })

  it("一意制約の無い表に乱数の id で行を作る migration は食い違う", () => {
    expect(
      check(`INSERT INTO "GradeItem" ("id", "gradeId", "name", "createdAt", "updatedAt")
        SELECT lower(hex(randomblob(16))), "id", 'synthetic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM "Grade"`)
    ).not.toEqual([])
  })
})
