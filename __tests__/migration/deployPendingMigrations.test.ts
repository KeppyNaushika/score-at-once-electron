/**
 * deployPendingMigrations のテスト
 *
 * migration.sql を better-sqlite3 の exec で適用することにより、
 * 複数文・PRAGMA・文字列リテラル内のセミコロンが正しく扱われることを検証する。
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_ROOT = path.join(os.tmpdir(), "deploy-migrations-test")
const DB_PATH = path.join(TEST_ROOT, "database.db")
const MIGRATIONS_DIR = path.join(TEST_ROOT, "migrations")

type SqliteDatabase = InstanceType<typeof Database>

const withDatabase = <T>(operation: (db: SqliteDatabase) => T): T => {
  const db = new Database(DB_PATH)
  try {
    return operation(db)
  } finally {
    db.close()
  }
}

/** _prisma_migrations を持つ最小のDBを用意する */
const createBaseDatabase = () => {
  withDatabase((db) => {
    db.exec(`
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
  })
}

/** 名前と本文を指定して migration ディレクトリを作る */
const writeMigration = (name: string, sql: string) => {
  const dir = path.join(MIGRATIONS_DIR, name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "migration.sql"), sql)
}

// getDatabasePath と getMigrationsDir をテスト用のパスへ向ける
vi.mock("../../electron-src/lib/prisma/databaseInitializer", () => ({
  getDatabasePath: () => DB_PATH,
}))

beforeEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(MIGRATIONS_DIR, { recursive: true })
  createBaseDatabase()
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

const loadDeployer = async () => {
  const module =
    await import("../../electron-src/lib/prisma/schema/migrationDeployer")
  return module.deployPendingMigrations
}

describe("deployPendingMigrations", () => {
  it("複数文のマイグレーションを適用し、適用済みとして記録する", async () => {
    writeMigration(
      "20260101000000_multi",
      `CREATE TABLE "A" (id TEXT PRIMARY KEY);
       CREATE TABLE "B" (id TEXT PRIMARY KEY);
       CREATE INDEX "A_id_idx" ON "A"(id);`
    )
    const deploy = await loadDeployer()

    expect(deploy({ migrationsDir: MIGRATIONS_DIR })).toBe(1)

    const tables = withDatabase(
      (db) =>
        db
          .prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('A','B')`
          )
          .all() as { name: string }[]
    )
    expect(tables.map((row) => row.name).sort()).toEqual(["A", "B"])

    const applied = withDatabase(
      (db) =>
        db
          .prepare(
            `SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = '20260101000000_multi'`
          )
          .all() as { migration_name: string }[]
    )
    expect(applied).toHaveLength(1)
  })

  it("文字列リテラル内のセミコロンを含む文でも壊れない", async () => {
    // 素朴な split(";") では 'a;b' の途中で分割され構文エラーになる
    writeMigration(
      "20260101000001_semicolon",
      `CREATE TABLE "Note" (id TEXT PRIMARY KEY, body TEXT);
       INSERT INTO "Note" (id, body) VALUES ('n1', 'first; second; third');`
    )
    const deploy = await loadDeployer()

    expect(deploy({ migrationsDir: MIGRATIONS_DIR })).toBe(1)

    const body = withDatabase(
      (db) =>
        (
          db.prepare(`SELECT body FROM "Note" WHERE id = 'n1'`).get() as {
            body: string
          }
        ).body
    )
    expect(body).toBe("first; second; third")
  })

  it("トリガ本体（BEGIN...END内のセミコロン）を含む文を適用できる", async () => {
    writeMigration(
      "20260101000002_trigger",
      `CREATE TABLE "Log" (id TEXT PRIMARY KEY, note TEXT);
       CREATE TABLE "Audit" (note TEXT);
       CREATE TRIGGER "log_ai" AFTER INSERT ON "Log"
       BEGIN
         INSERT INTO "Audit" (note) VALUES (NEW.note);
       END;`
    )
    const deploy = await loadDeployer()

    expect(deploy({ migrationsDir: MIGRATIONS_DIR })).toBe(1)

    withDatabase((db) => {
      db.prepare(`INSERT INTO "Log" (id, note) VALUES ('l1', 'hello')`).run()
      const audit = db.prepare(`SELECT note FROM "Audit"`).get() as {
        note: string
      }
      expect(audit.note).toBe("hello")
    })
  })

  it("適用済みのマイグレーションは再適用しない", async () => {
    writeMigration(
      "20260101000000_first",
      `CREATE TABLE "First" (id TEXT PRIMARY KEY);`
    )
    const deploy = await loadDeployer()

    expect(deploy({ migrationsDir: MIGRATIONS_DIR })).toBe(1)
    // 2回目は未適用ゼロ
    expect(deploy({ migrationsDir: MIGRATIONS_DIR })).toBe(0)
  })

  it("複数マイグレーションを名前順に適用する", async () => {
    writeMigration(
      "20260101000000_a",
      `CREATE TABLE "T1" (id TEXT PRIMARY KEY);`
    )
    writeMigration(
      "20260101000001_b",
      `ALTER TABLE "T1" ADD COLUMN "extra" TEXT;`
    )
    const deploy = await loadDeployer()

    expect(deploy({ migrationsDir: MIGRATIONS_DIR })).toBe(2)

    const columns = withDatabase((db) =>
      (db.prepare(`PRAGMA table_info("T1")`).all() as { name: string }[]).map(
        (column) => column.name
      )
    )
    expect(columns).toContain("extra")
  })

  it("失敗したマイグレーションはバックアップから復元され、記録されない", async () => {
    // 事前に実データを入れておき、復元で戻ることを確認する
    withDatabase((db) => {
      db.exec(`CREATE TABLE "Keep" (id TEXT PRIMARY KEY)`)
      db.prepare(`INSERT INTO "Keep" VALUES ('keep-me')`).run()
    })

    writeMigration(
      "20260101000000_broken",
      `CREATE TABLE "Half" (id TEXT PRIMARY KEY);
       THIS IS NOT VALID SQL;`
    )
    const deploy = await loadDeployer()

    expect(() => deploy({ migrationsDir: MIGRATIONS_DIR })).toThrow(
      /20260101000000_broken/
    )

    // 復元後: 壊れかけの Half は存在せず、_prisma_migrations に記録も無い
    const state = withDatabase((db) => ({
      hasHalf:
        (
          db
            .prepare(
              `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='Half'`
            )
            .get() as { count: number }
        ).count > 0,
      recorded: (
        db
          .prepare(
            `SELECT COUNT(*) as count FROM "_prisma_migrations" WHERE migration_name='20260101000000_broken'`
          )
          .get() as { count: number }
      ).count,
      keep: (
        db.prepare(`SELECT id FROM "Keep" WHERE id='keep-me'`).get() as
          { id: string } | undefined
      )?.id,
    }))

    expect(state.hasHalf).toBe(false)
    expect(state.recorded).toBe(0)
    expect(state.keep).toBe("keep-me")
  })

  it("_prisma_migrations テーブルが無ければ何もしない", async () => {
    fs.rmSync(DB_PATH, { force: true })
    withDatabase((db) => {
      db.exec(`CREATE TABLE "Unrelated" (id TEXT PRIMARY KEY)`)
    })
    writeMigration(
      "20260101000000_x",
      `CREATE TABLE "X" (id TEXT PRIMARY KEY);`
    )
    const deploy = await loadDeployer()

    expect(deploy({ migrationsDir: MIGRATIONS_DIR })).toBe(0)
  })
})
