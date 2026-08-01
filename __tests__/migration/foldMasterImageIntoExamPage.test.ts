/**
 * 20260801120000_fold_master_image_into_exam_page のデータ移行テスト
 *
 * 検証すること:
 * - 模範解答画像のパスと用紙サイズが ExamPage へ移り、ページ番号も日時も変わらない
 * - 模範解答の無いページ（旧実装でだけ作れた幽霊ページ）が消えず、答案画像も採点結果も残る
 * - 1ページに複数枚あった場合は古い方を採る（端末ごとに結果がぶれない）
 * - MasterImage テーブルが消える
 * - ExamPage を作り直しても子テーブルの FK が生きている（作り直し migration の定番の壊れ方）
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

const TEST_ROOT = path.join(os.tmpdir(), "fold-master-image")
const DB_PATH = path.join(TEST_ROOT, "database.db")
const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations")
const TARGET_MIGRATION = "20260801120000_fold_master_image_into_exam_page"

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
const LATER_ISO = "2026-07-02T00:00:00.000+00:00"

/**
 * 旧形状（模範解答画像が別テーブル）のデータを投入する。
 *
 * - page-normal: 模範解答1枚。B4 を明示している
 * - page-ghost: 模範解答が無く答案画像だけがある。旧実装で「答案が残るページの模範解答を
 *   削除した」ときにできる状態で、01-upload の一覧に出ないため教員からは見えなかった
 * - page-duplicated: 模範解答2枚。FK 上は作れたが実際には存在しない組み合わせ
 */
function seedLegacyMasterImages(db: SqliteDatabase): void {
  const run = (sql: string, params: unknown[]) => db.prepare(sql).run(params)

  run(
    `INSERT INTO "Exam" (id, examName, createdAt, updatedAt) VALUES (?,?,?,?)`,
    ["exam-1", "1学期期末", ISO, ISO]
  )
  run(
    `INSERT INTO "Student" (id, studentNumber, lastName, firstName, lastNameKana, firstNameKana, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?)`,
    ["student-1", "S001", "山田", "花子", "ヤマダ", "ハナコ", ISO, ISO]
  )
  run(
    `INSERT INTO "ExamStudent" (id, examId, studentId, status, createdAt, updatedAt) VALUES (?,?,?,?,?,?)`,
    ["exam-student-1", "exam-1", "student-1", "participating", ISO, ISO]
  )

  for (const [examPageId, pageNumber] of [
    ["page-normal", 1],
    ["page-ghost", 2],
    ["page-duplicated", 3],
  ] as const) {
    run(
      `INSERT INTO "ExamPage" (id, examId, pageNumber, createdAt, updatedAt) VALUES (?,?,?,?,?)`,
      [examPageId, "exam-1", pageNumber, ISO, ISO]
    )
  }

  run(
    `INSERT INTO "MasterImage" (id, examPageId, imagePath, pageSize, createdAt, updatedAt) VALUES (?,?,?,?,?,?)`,
    [
      "image-1",
      "page-normal",
      "exams/exam-1/master-images/p1.png",
      "B4",
      ISO,
      ISO,
    ]
  )
  run(
    `INSERT INTO "MasterImage" (id, examPageId, imagePath, pageSize, createdAt, updatedAt) VALUES (?,?,?,?,?,?)`,
    [
      "image-old",
      "page-duplicated",
      "exams/exam-1/master-images/old.png",
      "A4",
      ISO,
      ISO,
    ]
  )
  run(
    `INSERT INTO "MasterImage" (id, examPageId, imagePath, pageSize, createdAt, updatedAt) VALUES (?,?,?,?,?,?)`,
    [
      "image-new",
      "page-duplicated",
      "exams/exam-1/master-images/new.png",
      "A3",
      LATER_ISO,
      LATER_ISO,
    ]
  )

  // 幽霊ページに残っている答案画像と採点領域。移行で道連れにしてはいけないもの
  run(
    `INSERT INTO "StudentAnswerImage" (id, examPageId, examStudentId, imagePath, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?)`,
    [
      "answer-1",
      "page-ghost",
      "exam-student-1",
      "exams/exam-1/student-answers/a1.png",
      ISO,
      ISO,
    ]
  )
  run(
    `INSERT INTO "CropRegion" (id, examPageId, label, type, x, y, width, height, points, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      "crop-1",
      "page-ghost",
      "問1",
      "question",
      0.1,
      0.1,
      0.2,
      0.2,
      10,
      ISO,
      ISO,
    ]
  )
}

beforeEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(TEST_ROOT, { recursive: true })
})

afterEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

interface ExamPageRow {
  id: string
  pageNumber: number
  imagePath: string | null
  pageSize: string
  createdAt: string
}

const readExamPages = (): ExamPageRow[] =>
  withDatabase(
    (db) =>
      db
        .prepare(
          `SELECT id, pageNumber, imagePath, pageSize, createdAt
           FROM "ExamPage" ORDER BY pageNumber ASC`
        )
        .all() as ExamPageRow[]
  )

async function migrate(): Promise<void> {
  await buildDatabaseBeforeTargetMigration()
  withDatabase((db) => {
    seedLegacyMasterImages(db)
    applyMigration(db, TARGET_MIGRATION)
  })
}

describe("模範解答画像を試験ページへ畳む", () => {
  it("画像パスと用紙サイズがページへ移り、ページ番号も日時も変わらない", async () => {
    await migrate()

    expect(readExamPages()[0]).toEqual({
      id: "page-normal",
      pageNumber: 1,
      imagePath: "exams/exam-1/master-images/p1.png",
      pageSize: "B4",
      createdAt: ISO,
    })
  })

  it("模範解答の無いページは画像なしで残り、答案画像も採点領域も道連れにしない", async () => {
    await migrate()

    expect(readExamPages()[1]).toMatchObject({
      id: "page-ghost",
      // 空文字ではなく NULL。空文字だと Prisma の型が string を主張し続け、
      // 画像を読む側が欠落の分岐を書き忘れてもコンパイルが通ってしまう
      imagePath: null,
      pageSize: "A4",
    })

    const survivors = withDatabase(
      (db) =>
        db
          .prepare(
            `SELECT
               (SELECT COUNT(*) FROM "StudentAnswerImage" WHERE examPageId = 'page-ghost') AS answers,
               (SELECT COUNT(*) FROM "CropRegion" WHERE examPageId = 'page-ghost') AS regions`
          )
          .get() as { answers: number; regions: number }
    )
    expect(survivors).toEqual({ answers: 1, regions: 1 })
  })

  it("1ページに複数枚あったら古い方を採る", async () => {
    await migrate()

    expect(readExamPages()[2]).toMatchObject({
      id: "page-duplicated",
      imagePath: "exams/exam-1/master-images/old.png",
      pageSize: "A4",
    })
  })

  it("旧テーブルがスキーマから消える", async () => {
    await migrate()

    const tableNames = withDatabase((db) =>
      (
        db
          .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
          .all() as { name: string }[]
      ).map((row) => row.name)
    )

    expect(tableNames).not.toContain("MasterImage")
    expect(tableNames).toContain("ExamPage")
  })

  it("ページを作り直しても子テーブルの外部キーが生きている", async () => {
    await migrate()

    // 参照先の名前が旧名のまま取り残される事故を、定義文そのもので確かめる。
    // 空DBの foreign_key_check は参照先が消えていても素通りするので当てにしない
    const childDefinitions = withDatabase(
      (db) =>
        db
          .prepare(
            `SELECT name, sql FROM sqlite_master
             WHERE type = 'table' AND name IN ('CropRegion','StudentAnswerImage','CompoundAnswer')`
          )
          .all() as { name: string; sql: string }[]
    )
    expect(childDefinitions).toHaveLength(3)
    for (const definition of childDefinitions) {
      expect(definition.sql).toContain('REFERENCES "ExamPage" ("id")')
    }

    const remaining = withDatabase((db) => {
      db.pragma("foreign_keys = ON")
      db.prepare(`DELETE FROM "Exam" WHERE id = 'exam-1'`).run()
      return db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM "ExamPage") AS pages,
             (SELECT COUNT(*) FROM "StudentAnswerImage") AS answers,
             (SELECT COUNT(*) FROM "CropRegion") AS regions`
        )
        .get() as { pages: number; answers: number; regions: number }
    })
    expect(remaining).toEqual({ pages: 0, answers: 0, regions: 0 })
    expect(withDatabase((db) => db.pragma("foreign_key_check"))).toEqual([])
  })
})
