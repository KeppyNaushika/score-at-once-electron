/**
 * DateTime正規化マイグレーション (normalize_datetime_to_text) のテスト
 *
 * 背景: Prisma v7 の driver adapter (@prisma/adapter-better-sqlite3) は DateTime を
 * ISO 8601 text で読み書きするが、adapter移行前の既存データは integer(ms) のまま残り
 * 混在した。SQLiteの型優先順位 (integer < text) により、driver adapter が渡す text の
 * 基準日と integer の endDate が比較できず、成績の学級在籍フィルタが在籍者を拾えなくなる
 * (「学級追加→生徒0名」バグ)。本テストは migration が integer を ISO text へ正規化し、
 * 在籍フィルタが本番と同じ経路(Prismaクエリ + driver adapter)で正しく動くことを検証する。
 */
import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClientForPath } from "../helpers/testPrismaClient"

const TEST_DB_DIR = path.resolve(__dirname, "../../data")
const TEST_DB_PATH = path.join(TEST_DB_DIR, "test-normalize-datetime.db")
const MIGRATION_SQL = path.resolve(
  __dirname,
  "../../prisma/migrations/20260613144726_normalize_datetime_to_text/migration.sql"
)

// integer(ms) のサンプル値
const PAST_MS = 1743346800000 // 2025-03-30T15:00:00Z (基準日より過去 = 在籍終了)
const FUTURE_MS = 1806418800000 // 2027-03-30T15:00:00Z (基準日より未来 = 在籍中)
const START_MS = 1700000000000 // 2023-11 (開始日)
const REFERENCE = "2026-06-13T00:00:00.000+00:00"

let prisma: PrismaClient

const createPrisma = () => createPrismaClientForPath(TEST_DB_PATH)
const exec = (sql: string) => prisma.$executeRawUnsafe(sql)

const resetDb = async () => {
  if (prisma) await prisma.$disconnect()
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
  fs.writeFileSync(TEST_DB_PATH, "")
  prisma = createPrisma()
  await prisma.$connect()
}

/**
 * migration.sql を migrationDeployer と同じ ';' 分割ロジックで読み、
 * 指定テーブルへの UPDATE 文のみを適用する
 * (テストDBには全テーブルを作らないため対象を絞る)
 */
const applyMigrationFor = async (tables: string[]) => {
  const sql = fs.readFileSync(MIGRATION_SQL, "utf-8")
  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => {
      const stripped = statement
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/--[^\n]*/g, "")
        .trim()
      return stripped.length > 0
    })
  for (const statement of statements) {
    const match = statement.match(/UPDATE\s+"(\w+)"/)
    if (match && tables.includes(match[1])) {
      await prisma.$executeRawUnsafe(statement)
    }
  }
}

/** typeofごとの件数を返す */
const countByType = async (table: string, col: string) => {
  const rows = await prisma.$queryRawUnsafe<{ t: string; c: number }[]>(
    `SELECT typeof("${col}") AS t, COUNT(*) AS c FROM "${table}" GROUP BY typeof("${col}")`
  )
  return Object.fromEntries(rows.map((row) => [row.t, Number(row.c)]))
}

beforeAll(async () => {
  if (!fs.existsSync(TEST_DB_DIR))
    fs.mkdirSync(TEST_DB_DIR, { recursive: true })
  prisma = createPrisma()
})

afterEach(async () => {
  if (prisma) await prisma.$disconnect()
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
})

afterAll(async () => {
  if (prisma) await prisma.$disconnect()
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
})

const buildSchema = async () => {
  // FK制約はテストに不要なため省略。カラムは schema.prisma 準拠（Prismaクエリが通るよう全カラム）
  await exec(
    `CREATE TABLE "StudentClassMembership" ("id" TEXT NOT NULL PRIMARY KEY, "studentId" TEXT NOT NULL, "classId" TEXT NOT NULL, "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "endDate" DATETIME, "attendanceNumber" INTEGER, "notes" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)`
  )
  await exec(
    `CREATE TABLE "Grade" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT, "referenceDate" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)`
  )
}

/** integer(ms)形式の membership を3件注入（過去終了 / 未来終了 / 在籍中null） */
const insertIntegerMemberships = async () => {
  await exec(
    `INSERT INTO "StudentClassMembership" ("id","studentId","classId","startDate","endDate","updatedAt") VALUES ('m_past','s1','c1',${START_MS},${PAST_MS},${START_MS})`
  )
  await exec(
    `INSERT INTO "StudentClassMembership" ("id","studentId","classId","startDate","endDate","updatedAt") VALUES ('m_future','s2','c1',${START_MS},${FUTURE_MS},${START_MS})`
  )
  await exec(
    `INSERT INTO "StudentClassMembership" ("id","studentId","classId","startDate","endDate","updatedAt") VALUES ('m_active','s3','c1',${START_MS},NULL,${START_MS})`
  )
}

describe("DateTime正規化マイグレーション", () => {
  it("バグ再現→修正: integer形式のendDateは在籍フィルタで拾えず、正規化後に拾える", async () => {
    await resetDb()
    await buildSchema()
    await insertIntegerMemberships()

    // 適用前は endDate が integer
    expect(await countByType("StudentClassMembership", "endDate")).toEqual({
      integer: 2,
      null: 1,
    })

    // 本番と同じ経路を模す: driver adapter が Date を ISO text で渡すため、
    // $queryRawUnsafe に Date をバインドして integer(endDate) と比較する。
    // テーブルは normalize migration と同じ旧物理名 StudentClassMembership で作成しており、
    // 新物理名へマップされる Prisma クライアントでは参照できないため生SQLを用いる。
    const refDate = new Date(REFERENCE)
    const countActiveSince = async (): Promise<number> => {
      const rows = await prisma.$queryRawUnsafe<{ n: number | bigint }[]>(
        `SELECT COUNT(*) AS n FROM "StudentClassMembership" WHERE "endDate" IS NULL OR "endDate" >= ?`,
        refDate
      )
      return Number(rows[0].n)
    }

    // 【バグ再現】integer(endDate) >= text(基準日) は SQLite型優先順位で常にfalse。
    // 在籍中の未来終了(m_future)が除外され、null(m_active)の1件しか拾えない
    expect(await countActiveSince()).toBe(1)

    // 正規化マイグレーション適用
    await applyMigrationFor(["StudentClassMembership"])

    // 適用後は endDate が text に統一（integerは0件）
    expect(await countByType("StudentClassMembership", "endDate")).toEqual({
      text: 2,
      null: 1,
    })

    // 【修正確認】未来終了(m_future) + 在籍中(m_active) の2件が正しく拾える。
    // 過去終了(m_past)は基準日時点で在籍していないため除外されるのが正しい
    expect(await countActiveSince()).toBe(2)
  })

  it("変換形式が driver adapter と同一 (YYYY-MM-DDTHH:MM:SS.mmm+00:00)", async () => {
    await resetDb()
    await buildSchema()
    await insertIntegerMemberships()

    await applyMigrationFor(["StudentClassMembership"])

    // Prismaは DateTime列をDateオブジェクトに変換するため、CAST AS TEXTでDB格納の生値を取得
    const rows = await prisma.$queryRawUnsafe<{ endDate: string }[]>(
      `SELECT CAST("endDate" AS TEXT) AS endDate FROM "StudentClassMembership" WHERE "id" = 'm_past'`
    )
    expect(rows[0].endDate).toBe("2025-03-30T15:00:00.000+00:00")
  })

  it("冪等性: 再適用しても text 行は変化しない", async () => {
    await resetDb()
    await buildSchema()
    await insertIntegerMemberships()

    await applyMigrationFor(["StudentClassMembership"])
    const first = await prisma.$queryRawUnsafe<{ endDate: string }[]>(
      `SELECT CAST("endDate" AS TEXT) AS endDate FROM "StudentClassMembership" WHERE "id" = 'm_future'`
    )

    await applyMigrationFor(["StudentClassMembership"])
    const second = await prisma.$queryRawUnsafe<{ endDate: string }[]>(
      `SELECT CAST("endDate" AS TEXT) AS endDate FROM "StudentClassMembership" WHERE "id" = 'm_future'`
    )

    expect(second[0].endDate).toBe(first[0].endDate)
    expect(
      (await countByType("StudentClassMembership", "endDate")).integer ?? 0
    ).toBe(0)
  })

  // normalize_datetime_to_text (20260613144726) より後に追加されたテーブル。
  // driver adapter 移行後に新設されたため最初から ISO text で生まれ、integer(ms)
  // の混在が発生しない。よって正規化 UPDATE の対象外（網羅チェックから除外する）。
  // 歴史migrationは編集禁止のため、ここで明示的にホワイトリスト管理する。
  const POST_MIGRATION_TABLES = new Set([
    "AsbCharGuide",
    "AsbDefinitionTag", // 20260713000000 で追加。normalize migration より後で ISO text 生成
    "AuditLog",
    "Coursework",
    "CourseworkClassroom", // 旧 CourseworkClass（20260704010000 でリネーム）
    "CourseworkItem",
    "CourseworkLetterScale",
    "CourseworkScore",
    "CourseworkStudent",
    "CourseworkTag",
    "CropRegionAssignment", // 20260726100000 で追加。normalize migration より後で ISO text 生成
    "GradeConstraint",
    "GradeFrozenScore", // 20260725150000 で追加。normalize migration より後で ISO text 生成
    "ReturnSnapshot",
  ])

  // 20260704010000_rename_class_tables_to_classroom で物理名をリネームしたテーブル。
  // normalize migration (20260613144726) は旧物理名（classes / StudentClassMembership /
  // ExamClass / GradeClass）でこれらを既に正規化済みで、RENAME TO は ISO text データを
  // 保持するため再正規化は不要。歴史migrationは編集禁止のため現物理名を網羅チェックから除外する。
  const RENAMED_AFTER_NORMALIZATION = new Set([
    "Classroom",
    "StudentClassroomMembership",
    "ExamClassroom",
    "GradeClassroom",
  ])

  it("網羅性: migration.sql が schema.prisma の全 DateTime カラムをカバーする", () => {
    const schemaPath = path.resolve(__dirname, "../../prisma/schema.prisma")
    const schemaText = fs.readFileSync(schemaPath, "utf-8")
    const migrationText = fs.readFileSync(MIGRATION_SQL, "utf-8")

    // schema.prisma から (物理テーブル名, DateTimeカラム) を抽出
    const expected: [string, string][] = []
    const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g
    let modelMatch: RegExpExecArray | null
    while ((modelMatch = modelRe.exec(schemaText))) {
      const body = modelMatch[2]
      const mapMatch = body.match(/@@map\("([^"]+)"\)/)
      const table = mapMatch ? mapMatch[1] : modelMatch[1]
      if (
        POST_MIGRATION_TABLES.has(table) ||
        RENAMED_AFTER_NORMALIZATION.has(table)
      )
        continue
      for (const line of body.split("\n")) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 2 && parts[1].startsWith("DateTime")) {
          expected.push([table, parts[0]])
        }
      }
    }

    expect(expected.length).toBeGreaterThan(0)

    // 各 (table, col) に対応する UPDATE 文が migration.sql に存在すること
    const missing = expected.filter(
      ([table, column]) =>
        !migrationText.includes(`UPDATE "${table}" SET "${column}"`)
    )
    expect(missing).toEqual([])
  })

  it("分割健全性: migrationDeployer分割で全片がUPDATE文になる(コメント内セミコロン混入防止)", () => {
    // migrationDeployer は SQL を ';' で単純分割するため、コメント内にセミコロンがあると
    // 未閉じコメント片が実行対象に混入し "no statements" で落ちる。それを検出する。
    const sql = fs.readFileSync(MIGRATION_SQL, "utf-8")
    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter((statement) => {
        if (statement.length === 0) return false
        const stripped = statement
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/--[^\n]*/g, "")
          .trim()
        return stripped.length > 0
      })

    // filterを通過した全片は実行可能なUPDATE文であるべき
    const nonExecutable = statements.filter((statement) => {
      const stripped = statement
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/--[^\n]*/g, "")
        .trim()
      return !/^UPDATE\s+"/.test(stripped)
    })
    expect(nonExecutable).toEqual([])
  })
})
