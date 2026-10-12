/**
 * 統合アーカイブ（.sao）の archive.db を、メモリ上の接続として開く・書き戻す
 *
 * archive.db はファイルのパスで開かず、中身（バイト列）を `fs/promises` で読み書きし、
 * better-sqlite3 のメモリ上の DB（`new Database(buffer)` / `db.serialize()`）として扱う。
 * web 版の better-sqlite3（`web/worker/betterSqlite3Shim.ts`）は、アプリの DB 以外の
 * ファイルをパスでは開けない（ファイルは OPFS にあり、同期では読めない）ので、デスクトップ版と
 * 同じコードで動くように、読み書きを非同期の fs に寄せた。
 */

import Database from "better-sqlite3"
import * as fsPromises from "fs/promises"

import type { SqliteDatabase } from "../../prisma/sqliteSchemaUtils"

/** SQLite のファイルのヘッダーの、書き込みの版・読み取りの版の位置（2 なら WAL） */
const WRITE_VERSION_OFFSET = 18
const READ_VERSION_OFFSET = 19
const WAL_FILE_FORMAT = 2
const ROLLBACK_FILE_FORMAT = 1

/**
 * 中身からメモリ上の DB を開く。WAL の印が付いた中身（WAL で使っていた DB を serialize したもの）は、
 * メモリ上では WAL を使えないので、ロールバックジャーナルの印へ書き換えてから開く
 * （中身は同じ。`image` を書き換える）
 */
export function openDatabaseImage(
  image: Uint8Array,
  options: { readonly: boolean }
): SqliteDatabase {
  const imageBuffer = Buffer.from(
    image.buffer,
    image.byteOffset,
    image.byteLength
  )
  if (
    imageBuffer.byteLength > READ_VERSION_OFFSET &&
    imageBuffer[WRITE_VERSION_OFFSET] === WAL_FILE_FORMAT &&
    imageBuffer[READ_VERSION_OFFSET] === WAL_FILE_FORMAT
  ) {
    imageBuffer[WRITE_VERSION_OFFSET] = ROLLBACK_FILE_FORMAT
    imageBuffer[READ_VERSION_OFFSET] = ROLLBACK_FILE_FORMAT
  }
  return new Database(imageBuffer, { readonly: options.readonly })
}

/** ファイルを読み、メモリ上の DB として開く（ファイルは書き換えない。書き戻すなら `writeDatabaseFile`） */
export async function openDatabaseFile(
  databasePath: string,
  options: { readonly: boolean }
): Promise<SqliteDatabase> {
  return openDatabaseImage(await fsPromises.readFile(databasePath), options)
}

/** メモリ上の DB の中身をファイルへ書く。`exclusive` なら既にあるとき失敗する */
export async function writeDatabaseFile(
  db: SqliteDatabase,
  databasePath: string,
  options: { exclusive: boolean }
): Promise<void> {
  await fsPromises.writeFile(databasePath, db.serialize(), {
    flag: options.exclusive ? "wx" : "w",
  })
}
