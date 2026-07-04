import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { detectSchemaVersion } from "../../electron-src/lib/prisma/schema/versionDetector"
import { createPrismaClientForPath } from "../helpers/testPrismaClient"

const TEST_DB_DIR = path.resolve(__dirname, "../../data")
const TEST_DB_PATH = path.join(TEST_DB_DIR, "test-migration.db")

let prisma: PrismaClient

const createPrisma = () => createPrismaClientForPath(TEST_DB_PATH)

const execSql = async (sql: string) => {
  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement && !statement.startsWith("--"))
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement)
  }
}

const resetDb = async () => {
  await prisma.$disconnect()
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
  // 空ファイル作成
  fs.writeFileSync(TEST_DB_PATH, "")
  prisma = createPrisma()
  await prisma.$connect()
}

beforeAll(async () => {
  if (!fs.existsSync(TEST_DB_DIR))
    fs.mkdirSync(TEST_DB_DIR, { recursive: true })
  prisma = createPrisma()
})

afterEach(async () => {
  await prisma.$disconnect()
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
})

afterAll(async () => {
  await prisma.$disconnect()
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
})

describe("detectSchemaVersion", () => {
  it("空DBはUNKNOWNを返す", async () => {
    await resetDb()
    const version = await detectSchemaVersion(prisma)
    expect(version).toBe("UNKNOWN")
  })

  it("_prisma_migrationsが存在すればMIGRATEDを返す", async () => {
    await resetDb()
    await execSql(`
      CREATE TABLE "_prisma_migrations" (
        "id" TEXT PRIMARY KEY, "checksum" TEXT NOT NULL,
        "migration_name" TEXT NOT NULL, "started_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "finished_at" DATETIME, "rolled_back_at" DATETIME,
        "logs" TEXT, "applied_steps_count" INTEGER DEFAULT 0
      )
    `)
    const version = await detectSchemaVersion(prisma)
    expect(version).toBe("MIGRATED")
  })

  it("S3: Projectのみ、PageImage存在", async () => {
    await resetDb()
    await execSql(`
      CREATE TABLE "Project" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "PageImage" ("id" TEXT PRIMARY KEY)
    `)
    const version = await detectSchemaVersion(prisma)
    expect(version).toBe("S3")
  })

  it("S4: Project + ProjectClass存在", async () => {
    await resetDb()
    await execSql(`
      CREATE TABLE "Project" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "ProjectClass" ("id" TEXT PRIMARY KEY)
    `)
    const version = await detectSchemaVersion(prisma)
    expect(version).toBe("S4")
  })

  it("S5: Project + MasterImage存在", async () => {
    await resetDb()
    await execSql(`
      CREATE TABLE "Project" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "ProjectClass" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "MasterImage" ("id" TEXT PRIMARY KEY)
    `)
    const version = await detectSchemaVersion(prisma)
    expect(version).toBe("S5")
  })

  it("S6: Project + GradeProject存在", async () => {
    await resetDb()
    await execSql(`
      CREATE TABLE "Project" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "ProjectClass" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "MasterImage" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "GradeProject" ("id" TEXT PRIMARY KEY)
    `)
    const version = await detectSchemaVersion(prisma)
    expect(version).toBe("S6")
  })

  it("S7: Examテーブル存在（CropRegionOmrConfigなし）", async () => {
    await resetDb()
    await execSql(`
      CREATE TABLE "Exam" ("id" TEXT PRIMARY KEY)
    `)
    const version = await detectSchemaVersion(prisma)
    expect(version).toBe("S7")
  })

  it("S8: Exam + CropRegionOmrConfig存在", async () => {
    await resetDb()
    await execSql(`
      CREATE TABLE "Exam" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "CropRegionOmrConfig" ("id" TEXT PRIMARY KEY)
    `)
    const version = await detectSchemaVersion(prisma)
    expect(version).toBe("S8")
  })

  it("S9: Exam + DeletedRecord + UserPreference(KV)", async () => {
    await resetDb()
    await execSql(`
      CREATE TABLE "Exam" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "CropRegionOmrConfig" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "DeletedRecord" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "UserPreference" ("id" TEXT PRIMARY KEY, "userId" TEXT, "key" TEXT, "value" TEXT)
    `)
    const version = await detectSchemaVersion(prisma)
    expect(version).toBe("S9")
  })
})
