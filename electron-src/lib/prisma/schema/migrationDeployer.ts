import { PrismaClient } from "@prisma/client"
import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"

import { tableExists } from "../databaseUtils"

/**
 * prisma/migrations/ ディレクトリから未適用のマイグレーションを検出し、順番に適用する。
 * _prisma_migrationsテーブルを参照・更新して適用状態を管理する。
 */
export const deployPendingMigrations = async (
  prisma: PrismaClient
): Promise<number> => {
  if (!(await tableExists(prisma, "_prisma_migrations"))) {
    console.warn(
      "deployPendingMigrations: _prisma_migrations table not found, skipping"
    )
    return 0
  }

  const migrationsDir = getMigrationsDir()
  if (!migrationsDir || !fs.existsSync(migrationsDir)) {
    console.warn(`Migrations directory not found: ${migrationsDir}`)
    return 0
  }

  // 適用済みマイグレーション名を取得
  const applied = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT "migration_name" FROM "_prisma_migrations" WHERE "rolled_back_at" IS NULL ORDER BY "migration_name"`
  )
  const appliedNames = new Set(applied.map((r) => r.migration_name))

  // マイグレーションディレクトリをスキャン
  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "migration_lock.toml")
    .map((d) => d.name)
    .sort()

  let appliedCount = 0

  for (const dirName of dirs) {
    if (appliedNames.has(dirName)) continue

    const sqlPath = path.join(migrationsDir, dirName, "migration.sql")
    if (!fs.existsSync(sqlPath)) continue

    const sql = fs.readFileSync(sqlPath, "utf-8")
    const checksum = crypto.createHash("sha256").update(sql).digest("hex")

    console.info(`Applying migration: ${dirName}`)
    const startedAt = new Date().toISOString()

    try {
      // SQLを文単位で分割して実行
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"))

      for (const stmt of statements) {
        await prisma.$executeRawUnsafe(stmt)
      }

      // 適用成功を記録
      const id = generateUuid()
      const finishedAt = new Date().toISOString()
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
         VALUES ('${id}', '${checksum}', '${finishedAt}', '${dirName}', '${startedAt}', 1)`
      )

      appliedCount++
      console.info(`Migration applied: ${dirName}`)
    } catch (error) {
      console.error(`Migration failed: ${dirName}`, error)
      throw new Error(
        `Migration ${dirName} failed: ${error instanceof Error ? error.message : error}`
      )
    }
  }

  if (appliedCount > 0) {
    console.info(`${appliedCount} migration(s) applied successfully`)
  }

  return appliedCount
}

/** prisma/migrations/ ディレクトリのパスを解決する */
const getMigrationsDir = (): string | null => {
  // 開発環境: プロジェクトルートの prisma/migrations/
  const devPath = path.join(process.cwd(), "prisma", "migrations")
  if (fs.existsSync(devPath)) return devPath

  // パッケージ化環境: app.asar の隣
  try {
    const { app } = require("electron")
    const appPath = app.getAppPath()
    const candidates = [
      path.join(appPath, "prisma", "migrations"),
      path.join(appPath, "..", "prisma", "migrations"),
      path.join(path.dirname(appPath), "prisma", "migrations"),
    ]
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate
    }
  } catch {
    // electron未ロード時
  }

  return null
}

const generateUuid = (): string => {
  const hex = (n: number) =>
    Array.from({ length: n }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("")
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${hex(3)}-${hex(12)}`
}
