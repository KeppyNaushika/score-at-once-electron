/**
 * 削除の同期伝搬テスト（画面なし・2クライアント）
 *
 * sqlite-nas-sync は Electron に依存しない素の Node ライブラリなので、
 * 一時ディレクトリに「PC-A の DB」「PC-B の DB」「NAS」を作れば実機2台を用意せずに
 * 削除の伝わり方を検証できる。
 *
 * 検証の主眼は **アプリの時刻形式 × ライブラリの LWW 比較** の組み合わせ:
 * - アプリ（Prisma）が書く `updatedAt` は ISO-T 形式 `2026-07-26T08:00:00.000+00:00`
 * - ライブラリのトリガーが書く `_tombstone.deletedAt` は **0.19.0 から同じ ISO-T の
 *   ミリ秒付き**（`strftime('%Y-%m-%dT%H:%M:%fZ','now')`）
 *
 * **0.18.0 までは `datetime('now')` の秒精度スペース形式 `2026-07-26 09:00:00` だった。**
 * 素の文字列で比較すると、同日なら10文字目が `' '(0x20) < 'T'(0x54)` となり
 * 「削除は常に古い」と誤判定され、**削除したレコードがフルマージで復活する**。
 * 0.13.1 の `isLaterTimestamp`（julianday 正規化）がこれを解消し、0.19.0 で書式そのものが
 * 揃った（同じ秒の中で削除が最大999ミリ秒ぶん過去へずれる問題も、これで消えた）。
 *
 * **既に在るDBには秒精度・スペース形式の tombstone が残る**ので、混在しても前後が正しく
 * 決まることは引き続き固定する。この組み合わせはライブラリ単体のテストでは再現しない
 * （両方の時刻がトリガー由来になるため）。検出できるのはアプリ側のこのテストだけなので、
 * ライブラリを更新するたびの回帰ガードとして機能させる（issue #918）。
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { setupSync } from "sqlite-nas-sync"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  SYNC_EXCLUDE_TABLES,
  SYNC_TABLE_OPTIONS,
} from "../../electron-src/lib/sync/syncTableConfig"

/** globalSetup が prisma db push で作る、schema.prisma 忠実な基準DB */
const GROUND_TRUTH_DB = path.resolve(__dirname, "../../data/test-database.db")

const TEST_ROOT = path.join(os.tmpdir(), "sync-delete-propagation")
const NAS_DIR = path.join(TEST_ROOT, "nas")
const DB_A = path.join(TEST_ROOT, "client-a", "database.db")
const DB_B = path.join(TEST_ROOT, "client-b", "database.db")

type SqliteDatabase = InstanceType<typeof Database>

const withDatabase = <T>(
  dbPath: string,
  operation: (db: SqliteDatabase) => T
) => {
  const db = new Database(dbPath)
  try {
    return operation(db)
  } finally {
    db.close()
  }
}

/** 基準DBを複製してクライアントDBを用意する（同期対象テーブルは実スキーマそのもの） */
const createClientDatabase = (dbPath: string): void => {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  fs.copyFileSync(GROUND_TRUTH_DB, dbPath)
  // 他テストの残骸を落とす。setupSync 前なのでトリガーは張られておらず changelog も汚れない
  withDatabase(dbPath, (db) => db.exec(`DELETE FROM "Tag"`))
}

const createSyncInstance = (dbPath: string, clientId: string) =>
  setupSync({
    dbPath,
    nasPath: NAS_DIR,
    clientId,
    excludeTables: SYNC_EXCLUDE_TABLES,
    tableOptions: SYNC_TABLE_OPTIONS,
    intervalMs: 60_000,
    changelogRetentionDays: 7,
    schemaVersion: "test-schema-version",
  })

/**
 * アプリ（Prisma driver adapter）が書くのと同じ ISO-T 形式で「少し前」の時刻を作る。
 *
 * トリガーの `datetime('now')` は **UTC** なので、固定値を置くと実行時のタイムゾーン次第で
 * 削除時刻より未来になり、LWW が正しく「更新の方が新しい」と判定してしまう。
 * 同じ UTC 日付のわずかに過去、という条件を満たすため SQLite 側で算出する。
 */
const recentIsoText = (dbPath: string): string =>
  withDatabase(
    dbPath,
    (db) =>
      (
        db
          .prepare(
            `SELECT strftime('%Y-%m-%dT%H:%M:%f', 'now', '-1 minute') || '+00:00' AS timestamp`
          )
          .get() as { timestamp: string }
      ).timestamp
  )

const insertTag = (
  dbPath: string,
  id: string,
  name: string,
  updatedAt: string
) =>
  withDatabase(dbPath, (db) =>
    db
      .prepare(
        `INSERT INTO "Tag" (id, name, "order", "createdAt", "updatedAt")
         VALUES (?, ?, 0, ?, ?)`
      )
      .run(id, name, updatedAt, updatedAt)
  )

const tagExists = (dbPath: string, id: string): boolean =>
  withDatabase(
    dbPath,
    (db) =>
      (
        db
          .prepare(`SELECT COUNT(*) AS count FROM "Tag" WHERE id = ?`)
          .get(id) as {
          count: number
        }
      ).count > 0
  )

beforeEach(() => {
  if (!fs.existsSync(GROUND_TRUTH_DB)) {
    throw new Error(
      "基準DB(test-database.db)が無い。globalSetup が db push で作成する想定"
    )
  }
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(NAS_DIR, { recursive: true })
  createClientDatabase(DB_A)
  createClientDatabase(DB_B)
})

afterEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe("削除の同期伝搬", () => {
  it("削除の時刻は、アプリの updatedAt と同じ精度・同じ書式で記録される（0.19.0）", () => {
    const syncA = createSyncInstance(DB_A, "client-a")
    insertTag(DB_A, "tag-1", "数学", recentIsoText(DB_A))
    withDatabase(DB_A, (db) => db.exec(`DELETE FROM "Tag" WHERE id = 'tag-1'`))
    syncA.stop()

    const { deletedAt, updatedAt } = withDatabase(DB_A, (db) => ({
      deletedAt: (
        db
          .prepare(`SELECT deletedAt FROM _tombstone WHERE recordId = 'tag-1'`)
          .get() as { deletedAt: string }
      ).deletedAt,
      updatedAt: recentIsoText(DB_A),
    }))

    // 両方とも ISO-T のミリ秒付き。ミリ秒まで在ることが要点で、秒に切り捨てられていると
    // 同じ秒の中で起きた削除と更新の前後が失われる（消したはずの行が復活する）
    expect(deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it("既に在るDBに残る秒精度・スペース形式の削除とも、前後が正しく決まる", () => {
    // 0.18.0 までのトリガーが書いた形。書式を揃えても、既存の行は書き換えられない
    // （切り捨てで失われたミリ秒は復元できない）ので、混在は残り続ける
    const legacyDeletedAt = "2026-07-26 09:00:00"
    const sameDayUpdatedAt = "2026-07-26T00:00:00.000+00:00"

    // 素の文字列比較では ' '(0x20) < 'T'(0x54) なので「あとから起きた削除」が古く出る
    expect(legacyDeletedAt > sameDayUpdatedAt).toBe(false)

    // julianday で正規化すれば正しく「削除の方が新しい」と判定される（0.13.1 の修正）
    const normalized = withDatabase(DB_A, (db) =>
      db
        .prepare(`SELECT julianday(?) AS deleted, julianday(?) AS updated`)
        .get(legacyDeletedAt, sameDayUpdatedAt)
    ) as { deleted: number; updated: number }
    expect(normalized.deleted > normalized.updated).toBe(true)
  })

  it("増分同期: 片方で削除するともう片方からも消える", async () => {
    const syncA = createSyncInstance(DB_A, "client-a")
    const syncB = createSyncInstance(DB_B, "client-b")

    insertTag(DB_A, "tag-1", "数学", recentIsoText(DB_A))
    await syncA.syncNow()
    await syncB.syncNow()
    expect(tagExists(DB_B, "tag-1")).toBe(true)

    withDatabase(DB_A, (db) => db.exec(`DELETE FROM "Tag" WHERE id = 'tag-1'`))
    await syncA.syncNow()
    await syncB.syncNow()

    expect(tagExists(DB_A, "tag-1")).toBe(false)
    expect(tagExists(DB_B, "tag-1")).toBe(false)

    syncA.stop()
    syncB.stop()
  })

  it("フルマージ: 長く止まっていた端末が復帰しても、同日に削除されたレコードは復活しない", async () => {
    const syncA = createSyncInstance(DB_A, "client-a")
    const syncB = createSyncInstance(DB_B, "client-b")

    // 1. A で作成し、B まで行き渡らせる（B の lastSeenId が記録される）
    insertTag(DB_A, "tag-1", "数学", recentIsoText(DB_A))
    await syncA.syncNow()
    await syncB.syncNow()
    expect(tagExists(DB_B, "tag-1")).toBe(true)

    // 2. A で削除。ここで tombstone に「今」の時刻が刻まれる（作成と同日）
    withDatabase(DB_A, (db) => db.exec(`DELETE FROM "Tag" WHERE id = 'tag-1'`))
    const deleteEntryId = withDatabase(
      DB_A,
      (db) =>
        (
          db
            .prepare(
              `SELECT MAX(id) AS id FROM _changelog WHERE recordId = 'tag-1' AND operation = 'DELETE'`
            )
            .get() as { id: number }
        ).id
    )

    // 3. B が止まっている間に changelog が保持期間を過ぎて刈られた状況を作る。
    //    削除の記録が changelog から消えるので、B は増分では削除を知り得ない
    insertTag(DB_A, "tag-keepalive", "英語", recentIsoText(DB_A))
    withDatabase(DB_A, (db) =>
      db.prepare(`DELETE FROM _changelog WHERE id <= ?`).run(deleteEntryId)
    )
    await syncA.syncNow()

    // 4. B が復帰 → ギャップ検出でフルマージが走る
    const resultB = await syncB.syncNow()
    expect(resultB.hadChangelogGap).toBe(true)

    // 5. フルマージで A の全データが流し込まれるが、tombstone により削除は維持される。
    //    0.12.0 では文字列比較が逆転して tag-1 が B に復活していた（issue #918）
    expect(tagExists(DB_B, "tag-1")).toBe(false)
    // フルマージ自体は機能している（削除されていない側は届く）
    expect(tagExists(DB_B, "tag-keepalive")).toBe(true)

    syncA.stop()
    syncB.stop()
  })
})
