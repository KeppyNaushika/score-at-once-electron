/**
 * アプリの表を書く接続が `PRAGMA recursive_triggers = ON` で開かれていることの固定
 *
 * sqlite-nas-sync v0.20.0 は、アプリの表への書き込みをトリガーで「行の版」「削除の版」
 * として帳簿へ写す。SQLite は `recursive_triggers` が OFF の接続では、`INSERT OR REPLACE`
 * が追い出した行の DELETE トリガーを発火させないので、その削除が事実にならない
 * （**警告も例外も出ない**）。設定は接続ごとで DB ファイルに残らないため、アプリが
 * 開く接続のすべてで立っていなければならない（ライブラリの前提 P12）。
 *
 * ここで見るのは:
 *
 * - アプリの Prisma クライアント（`createSharedPrismaClient`）が立てていること。
 *   `$disconnect()` のあと黙って張り直された接続でも立っていること
 * - その接続で `INSERT OR REPLACE` が追い出した行が、削除の版として帳簿に載ること。
 *   比べるために、立てていない接続では載らないことも見る（前提が本物であることの確認）
 * - better-sqlite3 の生接続（マイグレーション・初期スキーマ）の開き口が立てていること。
 *   マイグレーションの経路そのものは `deployPendingMigrations.test.ts` が見る
 */
import type { PrismaClient } from "@prisma/client"
import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import type { SyncInstance } from "sqlite-nas-sync"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import type * as DataManagerModule from "../../electron-src/lib/dataManager"
import { openAppDatabase } from "../../electron-src/lib/prisma/sqliteConnection"
import {
  createClientDatabase,
  createSyncInstance,
  isoMinutesAgo,
  withDatabase,
} from "./twoClientHarness"

const TEST_ROOT = path.join(os.tmpdir(), "score-at-once-recursive-triggers")
const USER_DATA = path.join(TEST_ROOT, "userData")
/** 同期を切っているときの接続先（`getDataDirectory()/database.db`） */
const DATA_DIR = path.join(TEST_ROOT, "data")
const APP_DB = path.join(DATA_DIR, "database.db")
const NAS_DIR = path.join(TEST_ROOT, "nas")

vi.mock("electron", () => ({
  app: {
    getPath: () => USER_DATA,
    getAppPath: () => TEST_ROOT,
    isPackaged: false,
  },
}))

vi.mock("../../electron-src/lib/dataManager", async (importOriginal) => ({
  ...(await importOriginal<typeof DataManagerModule>()),
  getDataDirectory: () => DATA_DIR,
}))

let prisma: PrismaClient
let syncInstance: SyncInstance

/** `PRAGMA recursive_triggers` を Prisma の接続越しに読む（1 が ON） */
const readRecursiveTriggers = async (client: PrismaClient) => {
  const rows = await client.$queryRawUnsafe<Array<{ flag: bigint | number }>>(
    `SELECT recursive_triggers AS flag FROM pragma_recursive_triggers`
  )
  return Number(rows[0].flag)
}

/** その id の Tag に削除の版が載っているか */
const hasDeleteVersion = (tagId: string): boolean =>
  withDatabase(
    APP_DB,
    (db) =>
      db
        .prepare(
          `SELECT 1 FROM "_tombstone" WHERE "tableName" = 'Tag' AND "recordId" = ?`
        )
        .get(tagId) !== undefined
  )

/** 同じ名前の Tag を別 id で `INSERT OR REPLACE` して、元の行を追い出す */
const replaceTagSql = (tagId: string, name: string, updatedAt: string) =>
  `INSERT OR REPLACE INTO "Tag" (id, name, "order", "createdAt", "updatedAt")
   VALUES ('${tagId}', '${name}', 0, '${updatedAt}', '${updatedAt}')`

beforeAll(async () => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(USER_DATA, { recursive: true })
  fs.mkdirSync(NAS_DIR, { recursive: true })
  createClientDatabase(APP_DB)
  // 帳簿とトリガーを張る（アプリが同期を有効にしたときと同じ状態）
  syncInstance = createSyncInstance(APP_DB, "client-a", NAS_DIR, "test")

  const { createSharedPrismaClient } =
    await import("../../electron-src/lib/prisma/databaseInitializer")
  prisma = createSharedPrismaClient()
})

afterAll(async () => {
  syncInstance.stop()
  await prisma.$disconnect()
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe("アプリの Prisma 接続", () => {
  it("recursive_triggers を立てて開く", async () => {
    expect(await readRecursiveTriggers(prisma)).toBe(1)
  })

  it("$disconnect のあと張り直された接続でも立っている", async () => {
    await prisma.$disconnect()
    // 明示の $connect を呼ばず、問い合わせで張り直させる（アプリの使い方と同じ）
    expect(await readRecursiveTriggers(prisma)).toBe(1)
  })

  it("INSERT OR REPLACE が追い出した行が、削除の版として帳簿に載る", async () => {
    const updatedAt = isoMinutesAgo(10)
    await prisma.$executeRawUnsafe(
      replaceTagSql("tag-prisma-old", "英語", updatedAt)
    )
    await prisma.$executeRawUnsafe(
      replaceTagSql("tag-prisma-new", "英語", updatedAt)
    )

    expect(hasDeleteVersion("tag-prisma-old")).toBe(true)
  })

  it("（比較）立てていない素の接続では、追い出した行の削除が帳簿に載らない", () => {
    const updatedAt = isoMinutesAgo(10)
    const db = new Database(APP_DB)
    try {
      db.exec(replaceTagSql("tag-raw-old", "数学", updatedAt))
      db.exec(replaceTagSql("tag-raw-new", "数学", updatedAt))
    } finally {
      db.close()
    }

    // 前提が本物であることの確認。ここが true になるなら、この設定は要らなくなっている
    expect(hasDeleteVersion("tag-raw-old")).toBe(false)
  })
})

describe("better-sqlite3 の生接続の開き口", () => {
  it("openAppDatabase は recursive_triggers を立てて開く", () => {
    const db = openAppDatabase(APP_DB)
    try {
      expect(db.pragma("recursive_triggers", { simple: true })).toBe(1)
    } finally {
      db.close()
    }
  })
})
