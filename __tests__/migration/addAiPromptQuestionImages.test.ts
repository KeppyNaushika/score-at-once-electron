/**
 * 20261011120000_add_ai_prompt_question_images のテスト
 *
 * プロンプトの問題の画像を何枚でも持てる表（AiPromptQuestionImage）を足し、旧列
 * AiPrompt.questionImagePath に値がある行を、新しい表へ1行として写す。次を確かめる。
 *
 * - 旧列に値のあるプロンプトだけ、sortOrder 0 の行が1つできる（NULL・空文字は写さない）
 * - 新しい行の id は uuidv4、時刻は元のプロンプトの行を写す
 * - 既存の行（AiPrompt）の id・時刻・旧列の値は変えない（docs/unified-archive-design.md §8 の1）
 * - プロンプトを消すと画像の行も消える
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

type SqliteDatabase = InstanceType<typeof Database>

const MIGRATION_SQL = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../prisma/migrations/20261011120000_add_ai_prompt_question_images/migration.sql"
  ),
  "utf-8"
)

const CREATED_AT = "2026-10-06T00:00:00.000Z"
const UPDATED_AT = "2026-10-07T12:34:56.789Z"
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

let db: SqliteDatabase

/** 適用前の定義（AiPrompt は列を絞ってある） */
const createPreMigrationSchema = (): void => {
  db.exec(`
    CREATE TABLE "AiPrompt" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "questionImagePath" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO "AiPrompt" ("id", "questionImagePath", "createdAt", "updatedAt") VALUES
      ('with-image', 'exams/exam/question.png', '${CREATED_AT}', '${UPDATED_AT}'),
      ('without-image', NULL, '${CREATED_AT}', '${UPDATED_AT}'),
      ('empty-image', '', '${CREATED_AT}', '${UPDATED_AT}');
  `)
}

interface QuestionImageRow {
  id: string
  promptId: string
  imagePath: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

const questionImageRows = (): QuestionImageRow[] =>
  db
    .prepare(`SELECT * FROM "AiPromptQuestionImage" ORDER BY "promptId"`)
    .all() as QuestionImageRow[]

describe("20261011120000_add_ai_prompt_question_images", () => {
  beforeEach(() => {
    db = new Database(":memory:")
    db.pragma("foreign_keys = ON")
    createPreMigrationSchema()
    db.exec(MIGRATION_SQL)
  })

  afterEach(() => {
    db.close()
  })

  it("旧列に値のあるプロンプトだけ、sortOrder 0 の行が1つできる", () => {
    const rows = questionImageRows()
    expect(
      rows.map((row) => ({
        promptId: row.promptId,
        imagePath: row.imagePath,
        sortOrder: row.sortOrder,
      }))
    ).toEqual([
      {
        promptId: "with-image",
        imagePath: "exams/exam/question.png",
        sortOrder: 0,
      },
    ])
  })

  it("新しい行の id は uuidv4、時刻は元のプロンプトの行を写す", () => {
    const [row] = questionImageRows()
    expect(row.id).toMatch(UUID_V4_PATTERN)
    expect(row.createdAt).toBe(CREATED_AT)
    expect(row.updatedAt).toBe(UPDATED_AT)
  })

  it("既存のプロンプトの行は変えない（旧列の値も残す）", () => {
    expect(db.prepare(`SELECT * FROM "AiPrompt" ORDER BY "id"`).all()).toEqual([
      {
        id: "empty-image",
        questionImagePath: "",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
      {
        id: "with-image",
        questionImagePath: "exams/exam/question.png",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
      {
        id: "without-image",
        questionImagePath: null,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    ])
  })

  it("プロンプトを消すと画像の行も消える", () => {
    db.exec(`DELETE FROM "AiPrompt" WHERE "id" = 'with-image'`)
    expect(questionImageRows()).toEqual([])
  })
})
