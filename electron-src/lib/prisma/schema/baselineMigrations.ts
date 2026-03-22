import { PrismaClient } from "@prisma/client"

import { tableExists } from "../databaseUtils"

/** ベースラインマイグレーション（現行スキーマの完全な初期マイグレーション） */
const MIGRATION_CHECKSUMS: ReadonlyArray<{ name: string; checksum: string }> = [
  {
    name: "20260322232329_init",
    checksum:
      "27f171863cf6ec6f3b74b48035a1db39f7e46cffc0927420b78ec1d1b905abc5",
  },
]

/** _prisma_migrationsテーブルを作成し、全既存マイグレーションを適用済みとしてマークする */
export const createBaseline = async (prisma: PrismaClient): Promise<void> => {
  // テーブルが既に存在する場合はスキップ
  if (await tableExists(prisma, "_prisma_migrations")) {
    console.info("_prisma_migrations table already exists, skipping baseline")
    return
  }

  // _prisma_migrationsテーブル作成
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "_prisma_migrations" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `)

  // 全マイグレーションを適用済みとして挿入
  const now = new Date().toISOString()
  for (const { name, checksum } of MIGRATION_CHECKSUMS) {
    const id = generateUuid()
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
       VALUES ('${id}', '${checksum}', '${now}', '${name}', '${now}', 1)`
    )
  }

  console.info(
    `Baseline created: ${MIGRATION_CHECKSUMS.length} migrations marked as applied`
  )
}

/** UUID v4を生成する */
const generateUuid = (): string => {
  const hex = (n: number) =>
    Array.from({ length: n }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("")
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${hex(3)}-${hex(12)}`
}
