/**
 * sqlite-nas-sync の入口（常駐の同期・移行や合流の1回きりの同期・同期の仕組みの取り除き）
 *
 * ライブラリ（better-sqlite3 を抱える）は使うときにだけ読む。
 *
 * **作ったインスタンスは、終わったとき・失敗したときに必ず `close()` すること。**
 * `close()` は `setupSync` が開いた接続を閉じる。閉じないと、その DB ファイルを
 * 消す・置き換える片づけが Windows では失敗する（開いているファイルは消せない）。
 */

import type { SyncConfig, SyncInstance } from "sqlite-nas-sync"

import { getSchemaVersion } from "./schemaVersion"
import { SYNC_EXCLUDE_TABLES, SYNC_TABLE_OPTIONS } from "./syncTableConfig"

/** 同期インスタンスを作る */
export async function createAppSyncInstance(options: {
  dbPath: string
  nasPath: string
  clientId: string
  intervalMs: number
  changelogRetentionDays: number
  onAfterSync?: SyncConfig["onAfterSync"]
}): Promise<SyncInstance> {
  const { setupSync } = await import("sqlite-nas-sync")
  return setupSync({
    dbPath: options.dbPath,
    nasPath: options.nasPath,
    clientId: options.clientId,
    excludeTables: SYNC_EXCLUDE_TABLES,
    tableOptions: SYNC_TABLE_OPTIONS,
    intervalMs: options.intervalMs,
    changelogRetentionDays: options.changelogRetentionDays,
    schemaVersion: getSchemaVersion(),
    onAfterSync: options.onAfterSync,
  })
}

/**
 * DB から同期の仕組み（ライブラリが作ったトリガーと内部の表）を取り除く。
 *
 * ライブラリの `removeSync` に任せる（何を取り除くかはライブラリだけが知っている）。
 * ライブラリを使ったことのない DB では何もしない。その DB の `SyncInstance` は、
 * 先に `close()` しておくこと。
 *
 * @returns 取り除いたトリガーと表の名前。何も無ければ空の配列
 */
export async function removeSyncMachinery(dbPath: string): Promise<string[]> {
  const { removeSync } = await import("sqlite-nas-sync")
  return removeSync(dbPath)
}
