/**
 * 20261005170000_exam_member_three_roles のテスト
 *
 * 試験の参加者のロールを OWNER / EDITOR / VIEWER の3つにし、結果出力の許可を足す
 * （docs/scoring-scope-and-permissions-design.md §3-3）。表を作り直すので、次を確かめる。
 *
 * - 'GRADER' は 'EDITOR' になり、'OWNER' はそのまま
 * - 既存の参加者は結果出力を許可された状態で始まる（採点者が結果出力を失わない）
 * - id・時刻・招待者はそのまま（docs/unified-archive-design.md §8 の1）
 * - 新しく足す行の既定は EDITOR・許可
 * - 外部キーと索引は元のまま
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

type SqliteDatabase = InstanceType<typeof Database>

const MIGRATION_SQL = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../prisma/migrations/20261005170000_exam_member_three_roles/migration.sql"
  ),
  "utf-8"
)

const CREATED_AT = "2026-08-01T00:00:00.000Z"
const UPDATED_AT = "2026-09-01T12:34:56.789Z"

let db: SqliteDatabase

/** 適用前の定義（2026-10-05 時点の本番の DDL を写したもの。親の表は列を絞ってある） */
const createPreMigrationSchema = (): void => {
  db.exec(`
    CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY);
    CREATE TABLE "Exam" ("id" TEXT NOT NULL PRIMARY KEY);

    CREATE TABLE "UserExam" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "examId" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'GRADER',
        "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "invitedBy" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UserExam_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UserExam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UserExam_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
    );
    CREATE INDEX "UserExam_examId_idx" ON "UserExam"("examId");
    CREATE UNIQUE INDEX "UserExam_userId_examId_key" ON "UserExam"("userId", "examId");
  `)
}

const seed = (): void => {
  db.exec(`
    INSERT INTO "User" ("id") VALUES ('owner'), ('grader');
    INSERT INTO "Exam" ("id") VALUES ('exam');
    INSERT INTO "UserExam" ("id", "userId", "examId", "role", "invitedAt", "invitedBy", "createdAt", "updatedAt")
      VALUES ('member-owner', 'owner', 'exam', 'OWNER', '${CREATED_AT}', NULL, '${CREATED_AT}', '${UPDATED_AT}'),
             ('member-grader', 'grader', 'exam', 'GRADER', '${CREATED_AT}', 'owner', '${CREATED_AT}', '${UPDATED_AT}');
  `)
}

interface UserExamRow {
  id: string
  userId: string
  examId: string
  role: string
  canExportResults: number
  invitedAt: string
  invitedBy: string | null
  createdAt: string
  updatedAt: string
}

const userExamRows = (): UserExamRow[] =>
  db.prepare(`SELECT * FROM "UserExam" ORDER BY "id"`).all() as UserExamRow[]

describe("20261005170000_exam_member_three_roles", () => {
  beforeEach(() => {
    db = new Database(":memory:")
    db.pragma("foreign_keys = ON")
    createPreMigrationSchema()
    seed()
    db.exec(MIGRATION_SQL)
  })

  afterEach(() => {
    db.close()
  })

  it("GRADER は EDITOR になり、OWNER はそのまま。全員が結果出力を許可された状態で始まる", () => {
    expect(
      userExamRows().map((row) => ({
        id: row.id,
        role: row.role,
        canExportResults: row.canExportResults,
      }))
    ).toEqual([
      { id: "member-grader", role: "EDITOR", canExportResults: 1 },
      { id: "member-owner", role: "OWNER", canExportResults: 1 },
    ])
  })

  it("id・時刻・招待者を変えない", () => {
    for (const row of userExamRows()) {
      expect(row.invitedAt).toBe(CREATED_AT)
      expect(row.createdAt).toBe(CREATED_AT)
      expect(row.updatedAt).toBe(UPDATED_AT)
    }
    expect(
      userExamRows().find((row) => row.id === "member-grader")?.invitedBy
    ).toBe("owner")
  })

  it("新しく足す行の既定は EDITOR・許可", () => {
    db.exec(`INSERT INTO "User" ("id") VALUES ('newcomer');`)
    db.exec(
      `INSERT INTO "UserExam" ("id", "userId", "examId") VALUES ('member-new', 'newcomer', 'exam');`
    )
    const added = userExamRows().find((row) => row.id === "member-new")
    expect(added).toMatchObject({ role: "EDITOR", canExportResults: 1 })
  })

  it("外部キーと索引は元のまま", () => {
    const foreignKeys = db
      .prepare(`PRAGMA foreign_key_list("UserExam")`)
      .all() as { from: string; table: string; on_delete: string }[]
    expect(
      foreignKeys
        .map(
          (foreignKey) =>
            `${foreignKey.from}->${foreignKey.table}:${foreignKey.on_delete}`
        )
        .sort()
    ).toEqual([
      "examId->Exam:CASCADE",
      "invitedBy->User:SET NULL",
      "userId->User:CASCADE",
    ])
    const indexes = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'UserExam' AND sql IS NOT NULL ORDER BY name`
      )
      .all() as { name: string }[]
    expect(indexes.map((index) => index.name)).toEqual([
      "UserExam_examId_idx",
      "UserExam_userId_examId_key",
    ])
    expect(db.prepare(`PRAGMA foreign_key_check`).all()).toEqual([])
  })

  it("利用者を消せば参加も消える（作り直しでカスケードを失っていない）", () => {
    db.exec(`DELETE FROM "User" WHERE "id" = 'grader';`)
    expect(userExamRows().map((row) => row.id)).toEqual(["member-owner"])
  })
})
