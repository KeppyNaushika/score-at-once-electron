import type { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { createBaseline } from "../../electron-src/lib/prisma/schema/baselineMigrations"
import { createPrismaClientForPath } from "../helpers/testPrismaClient"

const TEST_DB_DIR = path.resolve(__dirname, "../../data")
const TEST_DB_PATH = path.join(TEST_DB_DIR, "test-baseline.db")

let prisma: PrismaClient

const createPrisma = () => createPrismaClientForPath(TEST_DB_PATH)

const resetDb = async () => {
  await prisma.$disconnect()
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
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

describe("createBaseline", () => {
  it("_prisma_migrationsテーブルを作成し20件のレコードを挿入する", async () => {
    await resetDb()
    await createBaseline(prisma)

    const rows = await prisma.$queryRawUnsafe<
      { migration_name: string; checksum: string }[]
    >(
      `SELECT "migration_name", "checksum" FROM "_prisma_migrations" ORDER BY "migration_name"`
    )

    expect(rows.length).toBe(1)
    expect(rows[0].migration_name).toBe("20260322232329_init")

    // チェックサムが空でないことを確認
    for (const row of rows) {
      expect(row.checksum).toBeTruthy()
      expect(row.checksum.length).toBe(64) // SHA256
    }
  })

  it("既にテーブルが存在する場合はスキップする", async () => {
    await resetDb()
    await createBaseline(prisma)
    // 2回目の呼び出しはエラーにならない
    await createBaseline(prisma)

    const rows = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
      `SELECT COUNT(*) as cnt FROM "_prisma_migrations"`
    )
    expect(Number(rows[0].cnt)).toBe(1) // 重複挿入されない
  })
})
