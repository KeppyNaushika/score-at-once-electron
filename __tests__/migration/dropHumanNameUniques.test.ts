/**
 * 人が打つ名前の UNIQUE を外したこと（20260822140000_drop_human_name_uniques）を、
 * 新規インストールの経路で確かめる。
 *
 * 見るのは3つ:
 * - User.username / Classroom.name / Student.studentNumber を覆うユニーク索引が1本も無い
 *   （migration は名前指定の DROP INDEX IF EXISTS なので、名前が想定と違って残る抜けをここで塞ぐ）
 * - 巻き添えを出していない（Tag.name のユニークは残っている）
 * - シード（databaseSetup.runSeed）が2度走っても増えない
 *   ＝ upsert から findFirst + create へ置き換えた先が冪等である
 *
 * 実 DB には触らず、空DBへ init＋全マイグレーションを昇順適用したものを相手にする。
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { createBaseline } from "../../electron-src/lib/prisma/schema/baselineMigrations"
import { deployPendingMigrations } from "../../electron-src/lib/prisma/schema/migrationDeployer"
import { bootstrapSchema } from "../../electron-src/lib/prisma/schema/schemaBootstrap"
import { createPrismaClientForPath } from "../helpers/testPrismaClient"

const TEST_ROOT = path.join(os.tmpdir(), "drop-human-name-uniques")
const DB_PATH = path.join(TEST_ROOT, "database.db")
const REAL_MIGRATIONS = path.resolve(__dirname, "../../prisma/migrations")

// deployPendingMigrations / DatabaseSetup の接続先を、この一時DBへ向ける
// （どちらも既定では data/database.db を掴む）
const chainPrisma = { current: createPrismaClientForPath(DB_PATH) }
vi.mock("../../electron-src/lib/prisma/databaseInitializer", () => ({
  getDatabasePath: () => DB_PATH,
  createSharedPrismaClient: () => chainPrisma.current,
  initializeDatabase: () => "existing",
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

interface IndexListRow {
  indexName: string
  isUnique: number
}

const isIndexListRow = (row: unknown): row is IndexListRow =>
  typeof row === "object" &&
  row !== null &&
  "indexName" in row &&
  typeof row.indexName === "string" &&
  "isUnique" in row &&
  typeof row.isUnique === "number"

/**
 * ある表のある列を覆う索引を、ユニークかどうかつきで列挙する。
 * 暗黙の索引（主キーの sqlite_autoindex）も pragma_index_list に出るので、
 * 「名前を DROP INDEX し忘れた」以外の形で制約が残っていても見つかる。
 */
const indexesOnColumn = (
  tableName: string,
  columnName: string
): { name: string; unique: boolean }[] =>
  withDatabase((db) =>
    db
      .prepare(
        `SELECT il."name" AS indexName, il."unique" AS isUnique
           FROM pragma_index_list(?) il, pragma_index_info(il."name") ii
          WHERE ii."name" = ?
          ORDER BY il."name"`
      )
      .all(tableName, columnName)
      .filter(isIndexListRow)
      .map((index) => ({ name: index.indexName, unique: index.isUnique === 1 }))
  )

beforeAll(async () => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(TEST_ROOT, { recursive: true })

  bootstrapSchema(DB_PATH)
  const baselinePrisma = createPrismaClientForPath(DB_PATH)
  try {
    await createBaseline(baselinePrisma)
  } finally {
    await baselinePrisma.$disconnect()
  }
  deployPendingMigrations({ migrationsDir: REAL_MIGRATIONS })

  chainPrisma.current = createPrismaClientForPath(DB_PATH)
})

afterAll(async () => {
  await chainPrisma.current.$disconnect()
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe("人が打つ名前の UNIQUE を外す", () => {
  it("User.username / Classroom.name / Student.studentNumber を覆うユニーク索引が残っていない", () => {
    expect(indexesOnColumn("User", "username")).toEqual([])
    expect(indexesOnColumn("Classroom", "name")).toEqual([])

    // 学籍番号だけは非ユニーク索引を置き直している（取り込み1人につき1回引くため）
    expect(indexesOnColumn("Student", "studentNumber")).toEqual([
      { name: "Student_studentNumber_idx", unique: false },
    ])
  })

  it("残すと決めた UNIQUE を巻き添えにしていない", () => {
    // Tag.name は「同じ名前のタグは同じタグ」なので畳むのが望みの動作
    expect(indexesOnColumn("Tag", "name")).toEqual([
      { name: "Tag_name_key", unique: true },
    ])
    // 表示設定系（閉じた語彙・子なし）も残す
    expect(
      indexesOnColumn("ExamAnswerOverlayStyle", "overlayKind")
    ).toContainEqual({
      name: "ExamAnswerOverlayStyle_examId_overlayKind_key",
      unique: true,
    })
  })

  it("同じ username / 学級名 / 学籍番号の行を2つ作れる", async () => {
    const prisma = chainPrisma.current

    await prisma.user.create({
      data: { id: crypto.randomUUID(), username: "suzuki", name: "鈴木一郎" },
    })
    await prisma.user.create({
      data: { id: crypto.randomUUID(), username: "suzuki", name: "鈴木花子" },
    })

    await prisma.classroom.create({
      data: { id: crypto.randomUUID(), name: "3年1組", grade: 3 },
    })
    await prisma.classroom.create({
      data: { id: crypto.randomUUID(), name: "3年1組", grade: 3 },
    })

    await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        studentNumber: "20260001",
        lastName: "山田",
        firstName: "太郎",
        lastNameKana: "ヤマダ",
        firstNameKana: "タロウ",
      },
    })
    await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        studentNumber: "20260001",
        lastName: "佐藤",
        firstName: "花子",
        lastNameKana: "サトウ",
        firstNameKana: "ハナコ",
      },
    })

    expect(await prisma.user.count({ where: { username: "suzuki" } })).toBe(2)
    expect(await prisma.classroom.count({ where: { name: "3年1組" } })).toBe(2)
    expect(
      await prisma.student.count({ where: { studentNumber: "20260001" } })
    ).toBe(2)
  })

  it("シードは2度走っても増えない", async () => {
    // 動的 import: databaseInitializer のモックが効いた状態で読み込む
    const { DatabaseSetup } =
      await import("../../electron-src/lib/databaseSetup")
    const databaseSetup = new DatabaseSetup()
    const prisma = chainPrisma.current

    await databaseSetup.runSeed()
    const afterFirst = {
      admins: await prisma.user.count({ where: { username: "admin" } }),
      classrooms: await prisma.classroom.count({
        where: { name: "サンプル学級" },
      }),
      students: await prisma.student.count({
        where: { studentNumber: { in: ["STU001", "STU002", "STU003"] } },
      }),
      memberships: await prisma.studentClassroomMembership.count(),
      subtotals: await prisma.subtotal.count(),
    }
    expect(afterFirst).toEqual({
      admins: 1,
      classrooms: 1,
      students: 3,
      memberships: 3,
      subtotals: 3,
    })

    await databaseSetup.runSeed()
    expect({
      admins: await prisma.user.count({ where: { username: "admin" } }),
      classrooms: await prisma.classroom.count({
        where: { name: "サンプル学級" },
      }),
      students: await prisma.student.count({
        where: { studentNumber: { in: ["STU001", "STU002", "STU003"] } },
      }),
      memberships: await prisma.studentClassroomMembership.count(),
      subtotals: await prisma.subtotal.count(),
    }).toEqual(afterFirst)
  })
})
