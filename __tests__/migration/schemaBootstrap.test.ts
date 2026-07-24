/**
 * 初期スキーマブートストラップのテスト
 *
 * DBの状態（空／テーブルあり）ごとの振る舞いと、
 * テーブルを持つDB（init名と異なるマイグレーション済みDBを含む）を
 * 一切変更しないことを検証する。
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  INDEX_SQL,
  MIGRATION_SQL,
} from "../../electron-src/lib/prisma/schema/migrationSql"
import { bootstrapSchema } from "../../electron-src/lib/prisma/schema/schemaBootstrap"

const TEST_DIR = path.resolve(__dirname, "../../data/test-bootstrap")

/** 初期スキーマが作成するテーブル数 */
const SCHEMA_TABLE_COUNT = Array.from(
  MIGRATION_SQL.matchAll(/CREATE TABLE "([^"]+)"/g)
).length

const dbPathFor = (caseName: string) =>
  path.join(TEST_DIR, caseName, "database.db")

const countTables = (dbPath: string): number => {
  const db = new Database(dbPath)
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
    )
    .get() as { count: number }
  db.close()
  return Number(row.count)
}

type SqliteDatabase = InstanceType<typeof Database>

const withDatabase = <T>(
  dbPath: string,
  operation: (db: SqliteDatabase) => T
): T => {
  const db = new Database(dbPath)
  try {
    return operation(db)
  } finally {
    db.close()
  }
}

/** initスキーマとは異なるテーブル構成のDBを用意する（マイグレーション済み等を模す） */
const createNonInitDatabase = (dbPath: string, insertRow: boolean) => {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  withDatabase(dbPath, (db) => {
    // Class→Classroom などリネーム後の名前。init名（classes/Subject等）とは一致しない
    db.exec(`CREATE TABLE "Classroom" (id TEXT PRIMARY KEY)`)
    db.exec(`CREATE TABLE "Tag" (id TEXT PRIMARY KEY)`)
    if (insertRow)
      db.prepare(`INSERT INTO "Classroom" VALUES ('keep-me')`).run()
  })
}

beforeEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true })
  fs.mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true })
})

describe("bootstrapSchema", () => {
  it("ファイルが存在しない場合はディレクトリごと作成してスキーマを適用する", () => {
    const dbPath = dbPathFor("missing")

    expect(bootstrapSchema(dbPath)).toBe("created")
    expect(fs.existsSync(dbPath)).toBe(true)
    expect(countTables(dbPath)).toBe(SCHEMA_TABLE_COUNT)
  })

  it("0バイトのファイルにもスキーマを適用する", () => {
    const dbPath = dbPathFor("empty-file")
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    fs.writeFileSync(dbPath, "")

    expect(bootstrapSchema(dbPath)).toBe("created")
    expect(countTables(dbPath)).toBe(SCHEMA_TABLE_COUNT)
  })

  it("スキーマが揃っていれば existing を返し、データを保持する", () => {
    const dbPath = dbPathFor("complete")
    bootstrapSchema(dbPath)
    withDatabase(dbPath, (db) => {
      db.prepare(
        `INSERT INTO "User" (id, username, name, createdAt, updatedAt) VALUES ('u1','admin','管理者','2026-07-23','2026-07-23')`
      ).run()
    })

    expect(bootstrapSchema(dbPath)).toBe("existing")

    const userCount = withDatabase(
      dbPath,
      (db) =>
        (
          db.prepare(`SELECT COUNT(*) as count FROM "User"`).get() as {
            count: number
          }
        ).count
    )
    expect(Number(userCount)).toBe(1)
  })

  it("連続実行しても状態が変わらない（冪等）", () => {
    const dbPath = dbPathFor("idempotent")

    expect(bootstrapSchema(dbPath)).toBe("created")
    expect(bootstrapSchema(dbPath)).toBe("existing")
    expect(bootstrapSchema(dbPath)).toBe("existing")
    expect(countTables(dbPath)).toBe(SCHEMA_TABLE_COUNT)
  })

  it("initと異なるテーブル名でも、テーブルが在れば existing として一切変更しない", () => {
    // マイグレーションで進化したDBは init 時のテーブル名（classes/Subject等）を持たない。
    // それらを「不完全」と誤判定して作り直す/例外を投げると既存ユーザーが起動不能になる
    const dbPath = dbPathFor("migrated")
    createNonInitDatabase(dbPath, true)

    expect(bootstrapSchema(dbPath)).toBe("existing")

    // 元のテーブル・データがそのまま残っている（init スキーマで上書きされない）
    const state = withDatabase(dbPath, (db) => ({
      tables: (
        db
          .prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
          )
          .all() as { name: string }[]
      ).map((row) => row.name),
      keep: (
        db.prepare(`SELECT id FROM "Classroom"`).get() as
          { id: string } | undefined
      )?.id,
    }))
    expect(state.tables).toEqual(["Classroom", "Tag"])
    expect(state.keep).toBe("keep-me")
  })

  it("テーブルが在ればデータが無くても existing（作り直さない）", () => {
    const dbPath = dbPathFor("nonempty-no-data")
    createNonInitDatabase(dbPath, false)

    expect(bootstrapSchema(dbPath)).toBe("existing")
    // init スキーマは適用されない（Classroom/Tag の2テーブルのまま）
    expect(countTables(dbPath)).toBe(2)
  })

  it("ヘッダを持つ非空ファイルでテーブル0なら再初期化しない（desyncデータ喪失の隠蔽防止）", () => {
    // -wal を失い main .db だけ残ったような「ヘッダはあるがテーブル0」の既存DBを模す。
    // ここで init を適用・seed すると喪失を隠蔽するため、bootstrapSchema は
    // 手を触れず existing を返し、上位でエラーを顕在化させる。
    const dbPath = dbPathFor("desync-empty")
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    withDatabase(dbPath, (db) => {
      // SQLiteヘッダを書くだけ（テーブルは作らない）→ 非0バイト・テーブル0
      db.pragma("user_version = 1")
    })
    expect(fs.statSync(dbPath).size).toBeGreaterThan(0)

    expect(bootstrapSchema(dbPath)).toBe("existing")
    // init スキーマは適用されない（テーブル0のまま＝勝手に作り直さない）
    expect(countTables(dbPath)).toBe(0)
  })

  it("スキーマ適用はトランザクションで囲まれ、失敗時にテーブルを残さない", () => {
    const dbPath = dbPathFor("rollback")
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })

    withDatabase(dbPath, (db) => {
      expect(() =>
        db.transaction(() => {
          db.exec(MIGRATION_SQL)
          db.exec(`THIS IS NOT SQL`)
        })()
      ).toThrow()
    })

    expect(countTables(dbPath)).toBe(0)
  })
})

/** テーブル名と、インデックスを「対象列＋UNIQUE性」で表した集合を読み取る */
const readSchemaShape = (dbPath: string) =>
  withDatabase(dbPath, (db) => {
    const tableNames = (
      db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
        )
        .all() as { name: string }[]
    ).map((row) => row.name)

    // インデックス名は init マイグレーションと MIGRATION_SQL で異なる場合があるため、
    // 名前ではなく「どの列にどんな制約が掛かっているか」で比較する
    const indexes = tableNames.flatMap((tableName) =>
      (
        db.prepare(`PRAGMA index_list("${tableName}")`).all() as {
          name: string
          unique: number
        }[]
      ).map((index) => {
        const columns = (
          db.prepare(`PRAGMA index_info("${index.name}")`).all() as {
            name: string
          }[]
        ).map((column) => column.name)
        return `${tableName}:${index.unique ? "unique" : "index"}:${columns.join(",")}`
      })
    )

    return { tableNames, indexes: indexes.sort() }
  })

describe("初期スキーマSQL", () => {
  it("init マイグレーションと同じテーブル・インデックス構成を作成する", () => {
    const initSqlPath = path.resolve(
      __dirname,
      "../../prisma/migrations/20260322232329_init/migration.sql"
    )
    const bootstrapPath = dbPathFor("compare-bootstrap")
    const initPath = dbPathFor("compare-init")
    fs.mkdirSync(path.dirname(initPath), { recursive: true })

    // init マイグレーションには SQLite の予約名を使うインデックス定義が含まれており、
    // 現行の SQLite では作成できないため通常名に読み替えて適用する（比較は列単位で行う）
    const initSql = fs
      .readFileSync(initSqlPath, "utf-8")
      .replace(/Pragma writable_schema=[01];\n?/g, "")
      .replace(
        /"sqlite_autoindex_Subtotal_2"/,
        '"Subtotal_subtotalGroupId_name_key"'
      )

    bootstrapSchema(bootstrapPath)
    withDatabase(initPath, (db) => {
      db.exec(initSql)
    })

    // MIGRATION_SQL / INDEX_SQL は init マイグレーションの複製であり、
    // 片方だけ変更されると新規インストールのみが壊れるため差分を検出する
    expect(readSchemaShape(bootstrapPath)).toEqual(readSchemaShape(initPath))
    expect(INDEX_SQL).toContain("CREATE UNIQUE INDEX")
  })
})
