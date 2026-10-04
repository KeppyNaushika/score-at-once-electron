/**
 * 20261004150000_cascade_scoring_on_user_delete のテスト
 *
 * 利用者を削除できるようにするため（#1140）、採点系3表の User への外部キーを
 * ON DELETE NO ACTION → CASCADE へ、ReturnSnapshot.capturedByUserId を
 * CASCADE → SET NULL へ変える。表を作り直すマイグレーションなので、次を確かめる。
 *
 * - 行・id・時刻・値がそのまま残る
 * - 外部キーの ON DELETE だけが変わり、ON UPDATE とほかの外部キーは元のまま
 * - **子の DrawingAnnotation が消えない。** foreign_keys が ON のまま QuestionScore を
 *   DROP すると、カスケードで注釈が消え、同期の墓標として他の端末からも消える
 * - 適用後は、利用者を消すと採点系が消え、返却版は残って記録者だけ null になる
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

type SqliteDatabase = InstanceType<typeof Database>

const MIGRATION_SQL = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../prisma/migrations/20261004150000_cascade_scoring_on_user_delete/migration.sql"
  ),
  "utf-8"
)

const CREATED_AT = "2026-08-01T00:00:00.000Z"
const UPDATED_AT = "2026-09-01T12:34:56.789Z"

let db: SqliteDatabase

/** 適用前の定義（2026-10-04 時点の本番の DDL を写したもの。親の表は列を絞ってある） */
const createPreMigrationSchema = (): void => {
  db.exec(`
    CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY);
    CREATE TABLE "CropRegion" ("id" TEXT NOT NULL PRIMARY KEY);
    CREATE TABLE "ExamStudent" ("id" TEXT NOT NULL PRIMARY KEY);
    CREATE TABLE "CompoundAnswer" ("id" TEXT NOT NULL PRIMARY KEY);

    CREATE TABLE "QuestionScore" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "cropRegionId" TEXT NOT NULL,
        "examStudentId" TEXT NOT NULL,
        "partialScore" DECIMAL,
        "status" TEXT NOT NULL DEFAULT 'unscored',
        "userId" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "comment" TEXT NOT NULL DEFAULT '',
        CONSTRAINT "QuestionScore_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "QuestionScore_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "QuestionScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    );
    CREATE INDEX "QuestionScore_examStudentId_idx" ON "QuestionScore"("examStudentId");
    CREATE INDEX "QuestionScore_cropRegionId_idx" ON "QuestionScore"("cropRegionId");

    CREATE TABLE "DrawingAnnotation" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "questionScoreId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        CONSTRAINT "DrawingAnnotation_questionScoreId_fkey" FOREIGN KEY ("questionScoreId") REFERENCES "QuestionScore" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE "ScoreDecision" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "cropRegionId" TEXT NOT NULL,
        "examStudentId" TEXT NOT NULL,
        "verdict" TEXT NOT NULL,
        "score" DECIMAL,
        "comment" TEXT,
        "decidedByUserId" TEXT NOT NULL,
        "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ScoreDecision_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "ScoreDecision_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "ScoreDecision_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    );
    CREATE UNIQUE INDEX "ScoreDecision_cropRegionId_examStudentId_key" ON "ScoreDecision"("cropRegionId", "examStudentId");
    CREATE INDEX "ScoreDecision_examStudentId_idx" ON "ScoreDecision"("examStudentId");

    CREATE TABLE "CompoundAnswerScore" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "compoundAnswerId" TEXT NOT NULL,
        "examStudentId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "recognizedAnswer" TEXT,
        "status" TEXT NOT NULL DEFAULT 'unscored',
        "partialScore" DECIMAL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CompoundAnswerScore_compoundAnswerId_fkey" FOREIGN KEY ("compoundAnswerId") REFERENCES "CompoundAnswer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "CompoundAnswerScore_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "CompoundAnswerScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    );
    CREATE UNIQUE INDEX "CompoundAnswerScore_compoundAnswerId_examStudentId_key" ON "CompoundAnswerScore"("compoundAnswerId", "examStudentId");
    CREATE INDEX "CompoundAnswerScore_compoundAnswerId_idx" ON "CompoundAnswerScore"("compoundAnswerId");
    CREATE INDEX "CompoundAnswerScore_examStudentId_idx" ON "CompoundAnswerScore"("examStudentId");

    CREATE TABLE "ReturnSnapshot" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "examStudentId" TEXT NOT NULL,
        "scoresJson" TEXT NOT NULL,
        "totalScore" DECIMAL,
        "capturedByUserId" TEXT,
        "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ReturnSnapshot_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "ReturnSnapshot_capturedByUserId_fkey" FOREIGN KEY ("capturedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
    );
    CREATE UNIQUE INDEX "ReturnSnapshot_examStudentId_key" ON "ReturnSnapshot"("examStudentId");
  `)
}

/** 利用者 A の採点・注釈・確定・複合採点・返却版を1件ずつ入れる */
const insertRows = (): void => {
  db.exec(`
    INSERT INTO "User" ("id") VALUES ('user-a'), ('user-b');
    INSERT INTO "CropRegion" ("id") VALUES ('region-1');
    INSERT INTO "ExamStudent" ("id") VALUES ('exam-student-1');
    INSERT INTO "CompoundAnswer" ("id") VALUES ('compound-1');

    INSERT INTO "QuestionScore" ("id", "cropRegionId", "examStudentId", "partialScore", "status", "userId", "createdAt", "updatedAt", "comment")
      VALUES ('question-score-a', 'region-1', 'exam-student-1', 2.5, 'partial', 'user-a', '${CREATED_AT}', '${UPDATED_AT}', '途中式あり');
    INSERT INTO "DrawingAnnotation" ("id", "questionScoreId", "type")
      VALUES ('annotation-a', 'question-score-a', 'line');
    INSERT INTO "ScoreDecision" ("id", "cropRegionId", "examStudentId", "verdict", "score", "comment", "decidedByUserId", "decidedAt", "createdAt", "updatedAt")
      VALUES ('decision-a', 'region-1', 'exam-student-1', 'partial', 2.5, '確定', 'user-a', '${UPDATED_AT}', '${CREATED_AT}', '${UPDATED_AT}');
    INSERT INTO "CompoundAnswerScore" ("id", "compoundAnswerId", "examStudentId", "userId", "recognizedAnswer", "status", "partialScore", "createdAt", "updatedAt")
      VALUES ('compound-score-a', 'compound-1', 'exam-student-1', 'user-a', 'ABC', 'correct', 3, '${CREATED_AT}', '${UPDATED_AT}');
    INSERT INTO "ReturnSnapshot" ("id", "examStudentId", "scoresJson", "totalScore", "capturedByUserId", "capturedAt", "createdAt", "updatedAt")
      VALUES ('snapshot-1', 'exam-student-1', '{"scores":[]}', 80, 'user-a', '${UPDATED_AT}', '${CREATED_AT}', '${UPDATED_AT}');
  `)
}

type Row = Record<string, unknown>

const rowsOf = (tableName: string): Row[] =>
  db.prepare(`SELECT * FROM "${tableName}" ORDER BY "id"`).all() as Row[]

interface ForeignKeyRow {
  from: string
  table: string
  on_update: string
  on_delete: string
}

/** 表の外部キーを「列 → 親 ON DELETE … ON UPDATE …」の形で並べる */
const foreignKeysOf = (tableName: string): string[] =>
  (
    db
      .prepare(`SELECT * FROM pragma_foreign_key_list(?)`)
      .all(tableName) as ForeignKeyRow[]
  )
    .map(
      (foreignKey) =>
        `${foreignKey.from} → ${foreignKey.table} ON DELETE ${foreignKey.on_delete} ON UPDATE ${foreignKey.on_update}`
    )
    .sort()

const indexNamesOf = (tableName: string): string[] =>
  (
    db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL ORDER BY name`
      )
      .all(tableName) as { name: string }[]
  ).map((index) => index.name)

beforeEach(() => {
  // better-sqlite3 は foreign_keys を ON で開く（アプリの接続と同じ）
  db = new Database(":memory:")
  createPreMigrationSchema()
  insertRows()
})

afterEach(() => {
  db.close()
})

describe("20261004150000_cascade_scoring_on_user_delete", () => {
  it("行・id・時刻・値をそのまま残す（子の注釈も消えない）", () => {
    const tableNames = [
      "QuestionScore",
      "DrawingAnnotation",
      "ScoreDecision",
      "CompoundAnswerScore",
      "ReturnSnapshot",
    ]
    const before = Object.fromEntries(
      tableNames.map((tableName) => [tableName, rowsOf(tableName)])
    )

    db.exec(MIGRATION_SQL)

    const after = Object.fromEntries(
      tableNames.map((tableName) => [tableName, rowsOf(tableName)])
    )
    expect(after).toEqual(before)
    expect(after.DrawingAnnotation).toHaveLength(1)
    expect(db.prepare(`PRAGMA foreign_key_check`).all()).toEqual([])
  })

  it("User への外部キーの ON DELETE だけを変え、ほかの外部キーと索引は元のまま", () => {
    db.exec(MIGRATION_SQL)

    expect(foreignKeysOf("QuestionScore")).toEqual([
      "cropRegionId → CropRegion ON DELETE CASCADE ON UPDATE NO ACTION",
      "examStudentId → ExamStudent ON DELETE CASCADE ON UPDATE NO ACTION",
      "userId → User ON DELETE CASCADE ON UPDATE NO ACTION",
    ])
    expect(foreignKeysOf("ScoreDecision")).toEqual([
      "cropRegionId → CropRegion ON DELETE CASCADE ON UPDATE NO ACTION",
      "decidedByUserId → User ON DELETE CASCADE ON UPDATE NO ACTION",
      "examStudentId → ExamStudent ON DELETE CASCADE ON UPDATE NO ACTION",
    ])
    expect(foreignKeysOf("CompoundAnswerScore")).toEqual([
      "compoundAnswerId → CompoundAnswer ON DELETE CASCADE ON UPDATE CASCADE",
      "examStudentId → ExamStudent ON DELETE CASCADE ON UPDATE NO ACTION",
      "userId → User ON DELETE CASCADE ON UPDATE NO ACTION",
    ])
    expect(foreignKeysOf("ReturnSnapshot")).toEqual([
      "capturedByUserId → User ON DELETE SET NULL ON UPDATE NO ACTION",
      "examStudentId → ExamStudent ON DELETE CASCADE ON UPDATE NO ACTION",
    ])
    // 子の注釈は作り直した QuestionScore を指したまま
    expect(foreignKeysOf("DrawingAnnotation")).toEqual([
      "questionScoreId → QuestionScore ON DELETE CASCADE ON UPDATE CASCADE",
    ])

    expect(indexNamesOf("QuestionScore")).toEqual([
      "QuestionScore_cropRegionId_idx",
      "QuestionScore_examStudentId_idx",
    ])
    expect(indexNamesOf("ScoreDecision")).toEqual([
      "ScoreDecision_cropRegionId_examStudentId_key",
      "ScoreDecision_examStudentId_idx",
    ])
    expect(indexNamesOf("CompoundAnswerScore")).toEqual([
      "CompoundAnswerScore_compoundAnswerId_examStudentId_key",
      "CompoundAnswerScore_compoundAnswerId_idx",
      "CompoundAnswerScore_examStudentId_idx",
    ])
    expect(indexNamesOf("ReturnSnapshot")).toEqual([
      "ReturnSnapshot_examStudentId_key",
    ])
  })

  it("適用前は採点した利用者を消せず、適用後は採点系が消えて返却版の記録者が null になる", () => {
    expect(() =>
      db.prepare(`DELETE FROM "User" WHERE "id" = 'user-a'`).run()
    ).toThrow(/FOREIGN KEY constraint failed/)

    db.exec(MIGRATION_SQL)
    db.prepare(`DELETE FROM "User" WHERE "id" = 'user-a'`).run()

    expect(rowsOf("QuestionScore")).toEqual([])
    expect(rowsOf("DrawingAnnotation")).toEqual([])
    expect(rowsOf("ScoreDecision")).toEqual([])
    expect(rowsOf("CompoundAnswerScore")).toEqual([])
    expect(rowsOf("ReturnSnapshot")).toEqual([
      expect.objectContaining({ id: "snapshot-1", capturedByUserId: null }),
    ])
    // 関係の無い利用者は残る
    expect(rowsOf("User")).toEqual([{ id: "user-b" }])
  })
})
