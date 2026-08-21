/**
 * 新規インストールの初期化連鎖の統合テスト
 *
 * bootstrapSchema（init適用）→ createBaseline → deployPendingMigrations（実マイグレーション全適用）
 * を実際の prisma/migrations に対して通し、次を保証する:
 * - 同梱マイグレーションが空DBに昇順で全適用できる（順序破壊・SQL不正の検知）
 * - 適用後のDB（＝init名と異なる進化済みスキーマ）を bootstrapSchema が
 *   "existing" と判定し一切変更しない（起動不能回帰の統合レベルでの防止）
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createBaseline } from "../../electron-src/lib/prisma/schema/baselineMigrations"
import { deployPendingMigrations } from "../../electron-src/lib/prisma/schema/migrationDeployer"
import { bootstrapSchema } from "../../electron-src/lib/prisma/schema/schemaBootstrap"
import { createPrismaClientForPath } from "../helpers/testPrismaClient"

const TEST_ROOT = path.join(os.tmpdir(), "fresh-install-chain")
const DB_PATH = path.join(TEST_ROOT, "database.db")
const REAL_MIGRATIONS = path.resolve(__dirname, "../../prisma/migrations")

// deployPendingMigrations は接続先を getDatabasePath() で決めるため、テストDBへ向ける
vi.mock("../../electron-src/lib/prisma/databaseInitializer", () => ({
  getDatabasePath: () => DB_PATH,
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

const tableNames = (): string[] =>
  withDatabase((db) =>
    (
      db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
        )
        .all() as { name: string }[]
    ).map((row) => row.name)
  )

/** 空DBに init → ベースライン → 全マイグレーションを通す */
const buildFreshChain = async (): Promise<void> => {
  bootstrapSchema(DB_PATH)
  const prisma = createPrismaClientForPath(DB_PATH)
  try {
    await createBaseline(prisma)
  } finally {
    await prisma.$disconnect()
  }
  deployPendingMigrations({ migrationsDir: REAL_MIGRATIONS })
}

const localMigrationNames = (): string[] =>
  fs
    .readdirSync(REAL_MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

beforeEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(TEST_ROOT, { recursive: true })
})

afterEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe("新規インストールの初期化連鎖", () => {
  it("空DBにinit＋全マイグレーションを適用でき、以後 bootstrapSchema は existing を返す", async () => {
    // 1. init スキーマ適用
    expect(bootstrapSchema(DB_PATH)).toBe("created")

    // 2. ベースライン（init を適用済みとして記録）
    const prisma = createPrismaClientForPath(DB_PATH)
    try {
      await createBaseline(prisma)
    } finally {
      await prisma.$disconnect()
    }

    // 3. init 以降の実マイグレーションを全適用
    const applied = deployPendingMigrations({ migrationsDir: REAL_MIGRATIONS })
    const expectedPending = localMigrationNames().filter(
      (name) => name !== "20260322232329_init"
    ).length
    expect(applied).toBe(expectedPending)
    expect(applied).toBeGreaterThan(0)

    // 4. 進化後のスキーマ検証: 後発マイグレーションのテーブルが在り、init名は消えている
    const tables = new Set(tableNames())
    expect(tables.has("Classroom")).toBe(true) // Class→Classroom リネーム後
    expect(tables.has("AsbDefinitionTag")).toBe(true) // 後発マイグレーションで追加
    expect(tables.has("classes")).toBe(false) // init 名は残っていない
    expect(tables.has("Subject")).toBe(false)

    // 5. 起動不能回帰の防止: 進化済みDBを bootstrapSchema が existing 扱いで不変にする
    const before = fs.readFileSync(DB_PATH)
    expect(bootstrapSchema(DB_PATH)).toBe("existing")
    expect(fs.readFileSync(DB_PATH).equals(before)).toBe(true)

    // 6. 冪等: 再デプロイは0件
    expect(deployPendingMigrations({ migrationsDir: REAL_MIGRATIONS })).toBe(0)
  })

  it("全マイグレーション適用後に外部キーの不整合が残らない", async () => {
    await buildFreshChain()

    // 各マイグレーションは自分の中で foreign_keys を落として作り直すため、
    // 通しで適用した結果に dangling な参照が残っていないかは別に見る必要がある
    // （PRAGMA は接続の状態なので、1本の適用が通ることは整合の証明にならない）
    const violations = withDatabase((db) =>
      db.prepare(`PRAGMA foreign_key_check`).all()
    )
    expect(violations).toEqual([])
  })

  it("適用後のスキーマが db push 基準（schema.prisma）と全テーブルで列一致する", async () => {
    await buildFreshChain()

    // 基準: globalSetup が prisma db push で作る test-database.db（schema.prisma 忠実）
    const groundTruthPath = path.resolve(
      __dirname,
      "../../data/test-database.db"
    )
    if (!fs.existsSync(groundTruthPath)) {
      throw new Error(
        "基準DB(test-database.db)が無い。globalSetup が db push で作成する想定"
      )
    }

    const columnsByTable = (dbPath: string): Map<string, string[]> => {
      const db = new Database(dbPath)
      try {
        const names = (
          db
            .prepare(
              `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'`
            )
            .all() as { name: string }[]
        ).map((row) => row.name)
        return new Map(
          names.map((tableName) => [
            tableName,
            (
              db.prepare(`PRAGMA table_info("${tableName}")`).all() as {
                name: string
              }[]
            )
              .map((column) => column.name)
              .sort(),
          ])
        )
      } finally {
        db.close()
      }
    }

    const truth = columnsByTable(groundTruthPath)
    const chain = columnsByTable(DB_PATH)

    // 基準に在るテーブルが chain にも在り、列が完全一致すること
    // （20260613160451 の AsbDefinition 4列取りこぼしのような列ドリフトを検知する）
    const drift: string[] = []
    for (const [tableName, truthColumns] of truth) {
      const chainColumns = chain.get(tableName)
      if (!chainColumns) {
        drift.push(`テーブル欠落: ${tableName}`)
        continue
      }
      const missing = truthColumns.filter((c) => !chainColumns.includes(c))
      const extra = chainColumns.filter((c) => !truthColumns.includes(c))
      if (missing.length > 0 || extra.length > 0) {
        drift.push(
          `${tableName}: 欠落[${missing.join(",")}] 余分[${extra.join(",")}]`
        )
      }
    }

    // 逆方向: 基準に無いテーブルが chain に残っていないこと
    // （DROP TABLE のマイグレーション漏れを検知する）
    for (const tableName of chain.keys()) {
      if (!truth.has(tableName)) {
        drift.push(`テーブル余分: ${tableName}`)
      }
    }

    expect(drift).toEqual([])
  })
})
