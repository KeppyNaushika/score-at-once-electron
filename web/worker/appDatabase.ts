/**
 * web 版のアプリの DB（OPFS 上の SQLite）を開いて持つ。
 *
 * sqlite-wasm の opfs-sahpool VFS を使う。COOP/COEP（SharedArrayBuffer）が要らない代わりに、
 * 1つのオリジンで同時に開けるのは1タブだけ（2つ目のタブは VFS の導入で失敗する）。
 *
 * 接続は**1本だけ**開いて、Prisma のアダプタとマイグレーションの両方で共有する
 * （`betterSqlite3Shim.ts` が better-sqlite3 の形に包む）。sahpool の VFS のロックは実質
 * 何もしないので、同じファイルへ接続を2本張ると、片方の書きかけのトランザクションを
 * もう片方が追い越して壊しうる。1本なら SQLite 自身が順序を守る。
 *
 * 既定値の違い: better-sqlite3 は外部キー制約を ON で開くが、sqlite-wasm は OFF で開く。
 * Prisma の `onDelete: Cascade` が効かなくなるので、開くたびに ON にする。
 */
import sqlite3InitModule, {
  type Database as WasmDatabase,
  type SAHPoolUtil,
  type Sqlite3Static,
} from "@sqlite.org/sqlite-wasm"
import * as path from "path"

import { SAHPOOL_DIRECTORY } from "./webPaths"

/** 開いた DB と、その持ち主の VFS */
export interface AppDatabaseHost {
  sqlite3: Sqlite3Static
  /** 今の接続。`replaceAppDatabase` で張り替わるので、使う側は毎回ここから読む */
  handle: WasmDatabase
  /** 仮想パス（`getStorageRoots().databasePath`）。sahpool の中のファイル名にもこれを使う */
  databasePath: string
}

/** sahpool が持つファイルの数。DB・ジャーナル・一時ファイルの分（既に作られた pool には効かない） */
const SAHPOOL_INITIAL_CAPACITY = 12

let pool: SAHPoolUtil | null = null
let host: AppDatabaseHost | null = null

/** 接続を開き、デスクトップ版の better-sqlite3 と同じ既定値にそろえる */
const openHandle = (
  sqlite3: Sqlite3Static,
  sahPool: SAHPoolUtil,
  databasePath: string
): WasmDatabase => {
  const handle = new sahPool.OpfsSAHPoolDb(databasePath)
  // 制約違反などを拡張コード（SQLITE_CONSTRAINT_UNIQUE 等）で返す。Prisma のアダプタは
  // 拡張コードの名前で違反の種類を見分ける
  sqlite3.capi.sqlite3_extended_result_codes(handle, 1)
  handle.exec("PRAGMA foreign_keys = ON")
  return handle
}

/**
 * アプリの DB を開く。起動時に1度だけ、データの根が決まったあとに呼ぶ。
 *
 * まだテーブルを作らない（初期スキーマとマイグレーションはデスクトップ版と同じ
 * `DatabaseSetup` が better-sqlite3 の形を通して行う）。
 */
export async function openAppDatabaseHost(
  databasePath: string
): Promise<AppDatabaseHost> {
  if (host !== null) {
    throw new Error("アプリの DB は起動時に1度だけ開く")
  }
  // 使うのは opfs-sahpool だけ。COOP/COEP の下では "opfs" / "opfs-wl" も自動で入れようとし、
  // 同梱しない補助 Worker を読めずにコンソールへエラーを出すので、初期化の前に止める
  Object.assign(globalThis, {
    sqlite3ApiConfig: {
      disable: { vfs: { opfs: true, "opfs-vfs": true, "opfs-wl": true } },
    },
  })
  const sqlite3 = await sqlite3InitModule()
  const sahPool = await sqlite3
    .installOpfsSAHPoolVfs({
      directory: SAHPOOL_DIRECTORY,
      initialCapacity: SAHPOOL_INITIAL_CAPACITY,
    })
    .catch((error: unknown) => {
      // 別のタブが同じ領域のファイルを握っていると、ここで取れずに失敗する
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(
        `データを開けない（別のタブで一括採点を開いていないか確かめる。web 版は1つのタブでしか開けない）: ${reason}`,
        { cause: error }
      )
    })
  const normalizedPath = path.normalize(databasePath)
  pool = sahPool
  host = {
    sqlite3,
    handle: openHandle(sqlite3, sahPool, normalizedPath),
    databasePath: normalizedPath,
  }
  return host
}

/** 開いた DB。開く前に呼ぶのは起動の順序の誤り */
export function getAppDatabaseHost(): AppDatabaseHost {
  if (host === null) {
    throw new Error("アプリの DB をまだ開いていない（起動の順序の誤り）")
  }
  return host
}

/** その仮想パスがアプリの DB（sahpool の中にあって fs の OPFS の階層には無い）か */
export function isAppDatabasePath(filePath: string): boolean {
  return host !== null && path.normalize(filePath) === host.databasePath
}

/** アプリの DB の大きさ（バイト）。fs の stat が返す */
export function getAppDatabaseByteLength(): number {
  const { handle } = getAppDatabaseHost()
  const pageCount = Number(handle.selectValue("PRAGMA page_count") ?? 0)
  const pageSize = Number(handle.selectValue("PRAGMA page_size") ?? 0)
  return pageCount * pageSize
}

/** アプリの DB の中身。マイグレーション前の控え（`createBackup` の copyFile）が読む */
export async function exportAppDatabase(): Promise<Uint8Array> {
  if (pool === null) throw new Error("アプリの DB をまだ開いていない")
  return pool.exportFile(getAppDatabaseHost().databasePath)
}

/**
 * アプリの DB の中身を差し替える。マイグレーションに失敗したときの復元
 * （`restoreBackup` の copyFile）が使う。接続を閉じて書き込み、開き直す
 */
export async function replaceAppDatabase(bytes: Uint8Array): Promise<void> {
  const current = getAppDatabaseHost()
  if (pool === null) throw new Error("アプリの DB をまだ開いていない")
  current.handle.close()
  try {
    await pool.importDb(current.databasePath, bytes)
  } finally {
    current.handle = openHandle(current.sqlite3, pool, current.databasePath)
  }
}
