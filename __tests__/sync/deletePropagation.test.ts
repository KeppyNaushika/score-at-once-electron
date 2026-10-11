/**
 * 削除の同期伝搬テスト（画面なし・2クライアント・本物の sqlite-nas-sync × 本物のスキーマ）
 *
 * 増分同期で削除が届くことは `twoClientSync.test.ts` の「作成・更新・削除が相手へ届く」が見る。
 * ここで見るのは削除に特有の2つ:
 *
 * - **削除の版の時刻。** sqlite-nas-sync 0.20.0 以降は、削除も「削除の版」として
 *   `_tombstone` に載り、順序は版の時刻 `_sns_ts` で決まる（`deletedAt` は記録用で、
 *   順序の鍵ではない）。削除の版の `_sns_ts` は「削除を実行した時刻」を、消した行の版の
 *   時刻まで引き上げた値（`src/rows/triggers.ts` の `deleteTsSql`）。実行した時刻は
 *   ミリ秒までの ISO-T（`NOW_SQL` = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`）で、アプリの
 *   `updatedAt` と同じ精度で比べられる。秒に切り捨てられると、同じ秒の中で起きた更新と削除の
 *   前後が失われ、消したはずの行が戻る
 * - **フルマージ。** 長く止まっていた端末は、相手の `_changelog` が刈られていると増分では
 *   読めず、相手の版を全部読み直す（`src/changelog.ts` の `hasChangelogGap`）。そのとき
 *   削除の版が行の版に負けて、消した行が復活しないこと（issue #918 の回帰ガード）
 */
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import type { SyncInstance } from "sqlite-nas-sync"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  createClientDatabase,
  createSyncInstance,
  deleteTag,
  insertTag,
  isoMinutesAgo,
  tagRows,
  withDatabase,
} from "./twoClientHarness"

const TEST_ROOT = path.join(os.tmpdir(), "sync-delete-propagation")
const NAS_DIR = path.join(TEST_ROOT, "nas")
const DB_A = path.join(TEST_ROOT, "client-a", "database.db")
const DB_B = path.join(TEST_ROOT, "client-b", "database.db")

/** 両端末で同じ値でなければ相手がスキーマ不一致でスキップされる */
const SCHEMA_VERSION = "delete-propagation-test"

let syncA: SyncInstance
let syncB: SyncInstance

const tagExists = (dbPath: string, id: string): boolean =>
  tagRows(dbPath).some((tag) => tag.id === id)

beforeEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(NAS_DIR, { recursive: true })
  createClientDatabase(DB_A)
  createClientDatabase(DB_B)
  syncA = createSyncInstance(DB_A, "client-a", NAS_DIR, SCHEMA_VERSION)
  syncB = createSyncInstance(DB_B, "client-b", NAS_DIR, SCHEMA_VERSION)
})

afterEach(() => {
  syncA.stop()
  syncB.stop()
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe("削除の同期伝搬", () => {
  it("削除の版の時刻（_sns_ts）は、削除を実行した時刻をミリ秒まで持ち、消した行の版より新しい", () => {
    const updatedAt = isoMinutesAgo(1)
    insertTag(DB_A, { id: "tag-1", name: "数学", updatedAt })
    deleteTag(DB_A, "tag-1")

    const tombstone = withDatabase(DB_A, (db) =>
      db
        .prepare<[string], { deleteTs: string; isNewerThanRow: number }>(
          `SELECT "_sns_ts" AS deleteTs,
                  julianday("_sns_ts") > julianday(?) AS isNewerThanRow
             FROM "_tombstone"
            WHERE "tableName" = 'Tag' AND "recordId" = 'tag-1'`
        )
        .get(updatedAt)
    )

    // ミリ秒まで在ることが要点。秒に切り捨てられていると、同じ秒の中で起きた削除と
    // 更新の前後が失われる（消したはずの行が復活する）
    expect(tombstone?.deleteTs).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    )
    // 1分前に書いた行の版より、削除の版のほうが強い
    expect(tombstone?.isNewerThanRow).toBe(1)
  })

  it("フルマージ: 長く止まっていた端末が復帰しても、同日に削除されたレコードは復活しない", async () => {
    // 1. A で作成し、B まで行き渡らせる（B の読み位置が記録される）
    insertTag(DB_A, { id: "tag-1", name: "数学", updatedAt: isoMinutesAgo(1) })
    await syncA.syncNow()
    await syncB.syncNow()
    expect(tagExists(DB_B, "tag-1")).toBe(true)

    // 2. A で削除。削除の版に「今」の時刻が刻まれる（作成と同日）
    deleteTag(DB_A, "tag-1")
    const deleteEntryId = withDatabase(
      DB_A,
      (db) =>
        db
          .prepare<[], { id: number }>(
            `SELECT MAX(id) AS id FROM _changelog WHERE recordId = 'tag-1' AND operation = 'DELETE'`
          )
          .get()?.id
    )
    expect(deleteEntryId).toBeDefined()

    // 3. B が止まっている間に changelog が保持期間を過ぎて刈られた状況を作る。
    //    削除の通知が changelog から消えるので、B は増分では削除を知り得ない
    insertTag(DB_A, {
      id: "tag-keepalive",
      name: "英語",
      updatedAt: isoMinutesAgo(1),
    })
    withDatabase(DB_A, (db) =>
      db.prepare(`DELETE FROM _changelog WHERE id <= ?`).run(deleteEntryId)
    )
    await syncA.syncNow()

    // 4. B が復帰 → 読めない id があるのでフルマージが走る
    const resultB = await syncB.syncNow()
    expect(resultB.hadChangelogGap).toBe(true)

    // 5. フルマージで A の版が全部読まれるが、削除の版が勝って削除は維持される
    expect(tagExists(DB_B, "tag-1")).toBe(false)
    // フルマージ自体は機能している（削除されていない側は届く）
    expect(tagExists(DB_B, "tag-keepalive")).toBe(true)
  })
})
