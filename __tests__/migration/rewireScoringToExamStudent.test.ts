/**
 * 20260728000000_rewire_scoring_to_exam_student のデータ移行テスト
 *
 * 検証すること:
 * - 受験者（ExamStudent）に紐づく採点データが examStudentId へ正しく付け替わる
 * - 受験者として登録されていない生徒の採点データ（孤児）は破棄される
 * - 孤児 QuestionScore にぶら下がる手書き注釈も道連れになる
 * - 破棄件数が AuditLog に記録される（0件のときは行を作らない）
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

const TEST_ROOT = path.join(os.tmpdir(), "rewire-scoring-to-exam-student")
const DB_PATH = path.join(TEST_ROOT, "database.db")
const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations")
const TARGET_MIGRATION = "20260728000000_rewire_scoring_to_exam_student"

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
 * 旧形状（採点層が studentId 直結）のデータを投入する。
 * 受験者として登録するのは student-kept のみ。student-orphan は
 * 「試験から外されたのに採点だけ残った生徒」を表す。
 */
function seedLegacyData(db: SqliteDatabase): void {
  const run = (sql: string, params: unknown[]) => db.prepare(sql).run(params)

  run(
    `INSERT INTO "User" (id, username, name, role, createdAt, updatedAt) VALUES (?,?,?,?,?,?)`,
    ["user-1", "grader", "採点者", "teacher", ISO, ISO]
  )
  run(
    `INSERT INTO "Exam" (id, examName, createdAt, updatedAt) VALUES (?,?,?,?)`,
    ["exam-1", "移行テスト", ISO, ISO]
  )
  run(
    `INSERT INTO "ExamPage" (id, examId, pageNumber, createdAt, updatedAt) VALUES (?,?,?,?,?)`,
    ["page-1", "exam-1", 1, ISO, ISO]
  )
  run(
    `INSERT INTO "CropRegion" (id, examPageId, label, type, x, y, width, height, points, orderIndex, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      "region-1",
      "page-1",
      "問1",
      "QUESTION_ANSWER",
      0,
      0,
      10,
      10,
      10,
      0,
      ISO,
      ISO,
    ]
  )
  run(
    `INSERT INTO "CompoundAnswer" (id, examPageId, label, answerFormat, correctAnswer, points, requireReduced, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    ["compound-1", "page-1", "アイ", "multi-digit", "42", 5, 0, ISO, ISO]
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

  // 受験者として登録されているのは student-kept だけ
  run(
    `INSERT INTO "ExamStudent" (id, examId, studentId, status, createdAt, updatedAt) VALUES (?,?,?,?,?,?)`,
    ["examstudent-kept", "exam-1", "student-kept", "participating", ISO, ISO]
  )

  for (const studentId of ["student-kept", "student-orphan"]) {
    run(
      `INSERT INTO "StudentAnswerImage" (id, examPageId, studentId, imagePath, createdAt, updatedAt) VALUES (?,?,?,?,?,?)`,
      [`image-${studentId}`, "page-1", studentId, `${studentId}.png`, ISO, ISO]
    )
    run(
      `INSERT INTO "QuestionScore" (id, cropRegionId, studentId, partialScore, status, userId, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        `score-${studentId}`,
        "region-1",
        studentId,
        null,
        "correct",
        "user-1",
        ISO,
        ISO,
      ]
    )
    run(
      `INSERT INTO "DrawingAnnotation" (id, questionScoreId, type, x, y, userId, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        `annot-${studentId}`,
        `score-${studentId}`,
        "circle",
        1,
        1,
        "user-1",
        ISO,
        ISO,
      ]
    )
    run(
      `INSERT INTO "ScoreDecision" (id, cropRegionId, studentId, verdict, decidedByUserId, decidedAt, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        `decision-${studentId}`,
        "region-1",
        studentId,
        "correct",
        "user-1",
        ISO,
        ISO,
        ISO,
      ]
    )
    run(
      `INSERT INTO "CompoundAnswerScore" (id, compoundAnswerId, studentId, userId, status, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?)`,
      [
        `compound-score-${studentId}`,
        "compound-1",
        studentId,
        "user-1",
        "correct",
        ISO,
        ISO,
      ]
    )
    run(
      `INSERT INTO "ReturnSnapshot" (id, examId, studentId, scoresJson, capturedAt, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?)`,
      [`snapshot-${studentId}`, "exam-1", studentId, "{}", ISO, ISO, ISO]
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

describe("採点層の ExamStudent 経由への配線変更マイグレーション", () => {
  it("受験者に紐づく行は付け替わり、孤児は破棄され、件数が監査ログに残る", async () => {
    await buildDatabaseBeforeTargetMigration()
    withDatabase((db) => seedLegacyData(db))
    withDatabase((db) => applyMigration(db, TARGET_MIGRATION))

    withDatabase((db) => {
      // 受験者のある生徒の行だけが残り、examStudentId へ付け替わっている
      expect(idsOf(db, "StudentAnswerImage")).toEqual(["image-student-kept"])
      expect(idsOf(db, "QuestionScore")).toEqual(["score-student-kept"])
      expect(idsOf(db, "ScoreDecision")).toEqual(["decision-student-kept"])
      expect(idsOf(db, "CompoundAnswerScore")).toEqual([
        "compound-score-student-kept",
      ])
      expect(idsOf(db, "ReturnSnapshot")).toEqual(["snapshot-student-kept"])

      const score = db
        .prepare(`SELECT examStudentId FROM "QuestionScore" WHERE id = ?`)
        .get("score-student-kept") as { examStudentId: string }
      expect(score.examStudentId).toBe("examstudent-kept")

      // 孤児 QuestionScore の注釈も道連れ。残した方の注釈は生きている
      expect(idsOf(db, "DrawingAnnotation")).toEqual(["annot-student-kept"])

      // ReturnSnapshot の examId 列は落ちている（ExamStudent から辿れるため）
      const columns = (
        db.prepare(`PRAGMA table_info("ReturnSnapshot")`).all() as {
          name: string
        }[]
      ).map((column) => column.name)
      expect(columns).not.toContain("examId")
      expect(columns).toContain("examStudentId")

      // 破棄件数が監査ログに残る
      const auditLogs = db
        .prepare(
          `SELECT summary, metadata FROM "AuditLog" WHERE action = 'system.migration.cleanup_orphaned_scores'`
        )
        .all() as { summary: string; metadata: string }[]
      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0].summary).toContain("5 件")
      expect(JSON.parse(auditLogs[0].metadata)).toEqual({
        studentAnswerImage: 1,
        questionScore: 1,
        scoreDecision: 1,
        compoundAnswerScore: 1,
        returnSnapshot: 1,
        drawingAnnotation: 1,
      })
    })
  })

  it("孤児が無ければ監査ログの行を作らない", async () => {
    await buildDatabaseBeforeTargetMigration()
    withDatabase((db) => {
      seedLegacyData(db)
      // 孤児の採点をあらかじめ全て取り除いておく
      db.exec(
        `DELETE FROM "StudentAnswerImage" WHERE studentId = 'student-orphan'`
      )
      db.exec(
        `DELETE FROM "DrawingAnnotation" WHERE id = 'annot-student-orphan'`
      )
      db.exec(`DELETE FROM "QuestionScore" WHERE studentId = 'student-orphan'`)
      db.exec(`DELETE FROM "ScoreDecision" WHERE studentId = 'student-orphan'`)
      db.exec(
        `DELETE FROM "CompoundAnswerScore" WHERE studentId = 'student-orphan'`
      )
      db.exec(`DELETE FROM "ReturnSnapshot" WHERE studentId = 'student-orphan'`)
    })
    withDatabase((db) => applyMigration(db, TARGET_MIGRATION))

    withDatabase((db) => {
      const count = db
        .prepare(
          `SELECT COUNT(*) AS n FROM "AuditLog" WHERE action = 'system.migration.cleanup_orphaned_scores'`
        )
        .get() as { n: number }
      expect(count.n).toBe(0)
      expect(idsOf(db, "QuestionScore")).toEqual(["score-student-kept"])
    })
  })

  it("差し替え後も子テーブルのFK参照名が正しい（RENAME TO の取り違え防止）", async () => {
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

      // new_ 接頭辞の一時テーブルが残っていない
      for (const name of definitions.keys()) {
        expect(name.startsWith("new_")).toBe(false)
      }

      // 差し替えた5テーブルは ExamStudent を参照している
      for (const table of [
        "StudentAnswerImage",
        "QuestionScore",
        "ScoreDecision",
        "CompoundAnswerScore",
        "ReturnSnapshot",
      ]) {
        expect(definitions.get(table)).toContain('REFERENCES "ExamStudent"')
      }

      // 子の DrawingAnnotation は差し替え後の QuestionScore を指している
      expect(definitions.get("DrawingAnnotation")).toContain(
        'REFERENCES "QuestionScore"'
      )
      expect(definitions.get("DrawingAnnotation")).not.toContain("new_")

      // 参照切れが無い
      expect(db.prepare(`PRAGMA foreign_key_check`).all()).toEqual([])
    })
  })
})
