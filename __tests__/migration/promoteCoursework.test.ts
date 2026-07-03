/**
 * promote_coursework マイグレーションの統合テスト
 *
 * 旧 manual 型 GradeDataSource（inputMode・ManualScore・GradeLetterScale を内包）を持つ
 * 旧スキーマDBに migration.sql を適用し、Coursework / CourseworkItem / CourseworkScore /
 * CourseworkStudent / CourseworkClass / CourseworkLetterScale へ正しく移送されること、
 * 特に「点数未入力の生徒も名簿（CourseworkStudent）に保護される」ことを検証する。
 */
import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClientForPath } from "../helpers/testPrismaClient"

const TEST_DB_DIR = path.resolve(__dirname, "../../data")
const TEST_DB_PATH = path.join(TEST_DB_DIR, "test-promote-coursework.db")
const MIGRATION_SQL = path.resolve(
  __dirname,
  "../../prisma/migrations/20260623100000_promote_coursework/migration.sql"
)

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

/** migrationDeployer と同じ ';' 分割ロジックで migration.sql を全文適用する */
const applyMigration = async () => {
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
  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt)
  }
}

/** 旧スキーマ（promote_coursework 適用前）の最小テーブルを作成 */
const buildOldSchema = async () => {
  await exec(
    `CREATE TABLE "classes" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL)`
  )
  await exec(
    `CREATE TABLE "Student" ("id" TEXT NOT NULL PRIMARY KEY, "studentNumber" TEXT NOT NULL)`
  )
  await exec(
    `CREATE TABLE "Tag" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL)`
  )
  await exec(
    `CREATE TABLE "Grade" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL)`
  )
  await exec(
    `CREATE TABLE "GradeItem" ("id" TEXT NOT NULL PRIMARY KEY, "gradeId" TEXT NOT NULL, "name" TEXT NOT NULL, "order" INTEGER NOT NULL DEFAULT 0)`
  )
  await exec(
    `CREATE TABLE "GradeClass" ("id" TEXT NOT NULL PRIMARY KEY, "gradeId" TEXT NOT NULL, "classId" TEXT NOT NULL, "order" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(
    `CREATE TABLE "GradeStudent" ("id" TEXT NOT NULL PRIMARY KEY, "gradeId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "customOrder" INTEGER, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(
    `CREATE TABLE "GradeDataSource" ("id" TEXT NOT NULL PRIMARY KEY, "gradeItemId" TEXT NOT NULL, "type" TEXT NOT NULL, "examId" TEXT, "subtotalId" TEXT, "cropRegionId" TEXT, "name" TEXT NOT NULL, "maxScore" DECIMAL NOT NULL, "weight" DECIMAL NOT NULL, "order" INTEGER NOT NULL DEFAULT 0, "absentMethod" TEXT NOT NULL DEFAULT 'null', "absentRatio" DECIMAL NOT NULL DEFAULT 1.0, "absentOffset" DECIMAL NOT NULL DEFAULT 0, "treatExpectedAsMissing" BOOLEAN NOT NULL DEFAULT false, "estimationMode" TEXT NOT NULL DEFAULT 'all', "estimationSourceIds" TEXT NOT NULL DEFAULT '[]', "inputMode" TEXT NOT NULL DEFAULT 'numeric', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(
    `CREATE TABLE "ManualScore" ("id" TEXT NOT NULL PRIMARY KEY, "gradeDataSourceId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "score" DECIMAL, "letterValue" TEXT, "adjustment" DECIMAL DEFAULT 0, "adjustmentReason" TEXT, "comment" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
  await exec(
    `CREATE TABLE "GradeLetterScale" ("id" TEXT NOT NULL PRIMARY KEY, "gradeDataSourceId" TEXT NOT NULL, "label" TEXT NOT NULL, "score" DECIMAL NOT NULL, "order" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  )
}

/** サンプルデータを注入（manual型DS・学級・生徒2名・点数1件・変換表） */
const seed = async () => {
  await exec(`INSERT INTO "classes" ("id","name") VALUES ('c1','1年A組')`)
  await exec(
    `INSERT INTO "Student" ("id","studentNumber") VALUES ('s1','S001')`
  )
  await exec(
    `INSERT INTO "Student" ("id","studentNumber") VALUES ('s2','S002')`
  )
  await exec(`INSERT INTO "Grade" ("id","name") VALUES ('g1','1学期成績')`)
  await exec(
    `INSERT INTO "GradeItem" ("id","gradeId","name","order") VALUES ('gi1','g1','知識',0)`
  )
  await exec(
    `INSERT INTO "GradeClass" ("id","gradeId","classId","order","updatedAt") VALUES ('gc1','g1','c1',0,'2026-06-23T00:00:00.000+00:00')`
  )
  // 生徒2名（s2 は点数未入力。名簿に残ることを検証する）
  await exec(
    `INSERT INTO "GradeStudent" ("id","gradeId","studentId","customOrder","updatedAt") VALUES ('gs1','g1','s1',0,'2026-06-23T00:00:00.000+00:00')`
  )
  await exec(
    `INSERT INTO "GradeStudent" ("id","gradeId","studentId","customOrder","updatedAt") VALUES ('gs2','g1','s2',1,'2026-06-23T00:00:00.000+00:00')`
  )
  // manual 型 DataSource（文字評価）
  await exec(
    `INSERT INTO "GradeDataSource" ("id","gradeItemId","type","name","maxScore","weight","inputMode","updatedAt") VALUES ('ds1','gi1','manual','レポート',100,100,'letter','2026-06-23T00:00:00.000+00:00')`
  )
  // 点数は s1 のみ
  await exec(
    `INSERT INTO "ManualScore" ("id","gradeDataSourceId","studentId","letterValue","adjustment","adjustmentReason","comment","updatedAt") VALUES ('ms1','ds1','s1','A',-5,'期限超過','良い','2026-06-23T00:00:00.000+00:00')`
  )
  // 変換表
  await exec(
    `INSERT INTO "GradeLetterScale" ("id","gradeDataSourceId","label","score","order","updatedAt") VALUES ('ls1','ds1','A',100,0,'2026-06-23T00:00:00.000+00:00')`
  )
  await exec(
    `INSERT INTO "GradeLetterScale" ("id","gradeDataSourceId","label","score","order","updatedAt") VALUES ('ls2','ds1','B',80,1,'2026-06-23T00:00:00.000+00:00')`
  )
}

const rawAll = async <T = Record<string, unknown>>(sql: string) =>
  prisma.$queryRawUnsafe<T[]>(sql)

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

describe("promote_coursework マイグレーション", () => {
  it("manual型DSが Coursework + 評価項目へ移送される", async () => {
    await resetDb()
    await buildOldSchema()
    await seed()
    await applyMigration()

    const cw = await rawAll(`SELECT * FROM "Coursework"`)
    expect(cw).toHaveLength(1)
    expect(cw[0].id).toBe("cw-ds1")
    expect(cw[0].name).toBe("レポート")

    const item = await rawAll(`SELECT * FROM "CourseworkItem"`)
    expect(item).toHaveLength(1)
    // 評価項目の id は元の GradeDataSource.id を流用
    expect(item[0].id).toBe("ds1")
    expect(item[0].courseworkId).toBe("cw-ds1")
    expect(Number(item[0].maxScore)).toBe(100)
    expect(item[0].inputMode).toBe("letter")
  })

  it("点数未入力の生徒も含めて全 GradeStudent が名簿へ移送される", async () => {
    await resetDb()
    await buildOldSchema()
    await seed()
    await applyMigration()

    const students = await rawAll<{ studentId: string }>(
      `SELECT * FROM "CourseworkStudent" ORDER BY "studentId"`
    )
    // s1（点数あり）と s2（点数なし）の両方が名簿に存在すること
    expect(students.map((student) => student.studentId)).toEqual(["s1", "s2"])
  })

  it("学級・点数・変換表が正しく移送される", async () => {
    await resetDb()
    await buildOldSchema()
    await seed()
    await applyMigration()

    const classes = await rawAll<{ classId: string }>(
      `SELECT * FROM "CourseworkClass"`
    )
    expect(classes).toHaveLength(1)
    expect(classes[0].classId).toBe("c1")

    // 点数（ManualScore.id を流用）
    const scores = await rawAll<{
      id: string
      courseworkItemId: string
      studentId: string
      letterValue: string
      adjustment: number
      comment: string
    }>(`SELECT * FROM "CourseworkScore"`)
    expect(scores).toHaveLength(1)
    expect(scores[0].id).toBe("ms1")
    expect(scores[0].courseworkItemId).toBe("ds1")
    expect(scores[0].studentId).toBe("s1")
    expect(scores[0].letterValue).toBe("A")
    expect(Number(scores[0].adjustment)).toBe(-5)
    expect(scores[0].comment).toBe("良い")

    // 変換表
    const scales = await rawAll<{ label: string; score: number }>(
      `SELECT * FROM "CourseworkLetterScale" ORDER BY "order"`
    )
    expect(scales.map((scale) => scale.label)).toEqual(["A", "B"])
  })

  it("GradeDataSource が coursework 参照へ置き換わり、旧テーブル・旧列が撤去される", async () => {
    await resetDb()
    await buildOldSchema()
    await seed()
    await applyMigration()

    const dataSources = await rawAll<{
      courseworkItemId: string
      type: string
    }>(`SELECT * FROM "GradeDataSource"`)
    expect(dataSources[0].courseworkItemId).toBe("ds1")
    expect(dataSources[0].type).toBe("coursework")

    // inputMode 列が撤去されている
    const cols = await rawAll<{ name: string }>(
      `SELECT name FROM pragma_table_info('GradeDataSource')`
    )
    expect(cols.map((column) => column.name)).not.toContain("inputMode")
    expect(cols.map((column) => column.name)).toContain("courseworkItemId")

    // 旧テーブルが DROP されている
    const tables = await rawAll<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table'`
    )
    const names = tables.map((table) => table.name)
    expect(names).not.toContain("ManualScore")
    expect(names).not.toContain("GradeLetterScale")
  })
})
