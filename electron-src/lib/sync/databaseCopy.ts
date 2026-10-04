/**
 * DB ファイルを丸ごと写す（移行・旧版からの引き継ぎで使う）
 */

import * as fs from "fs"
import * as path from "path"

import { openAppDatabase } from "../prisma/sqliteConnection"

/**
 * DB ファイルを丸ごと写す。**`fs.copyFileSync` を使ってはならない。**
 *
 * このアプリの DB は WAL モードで開く（`../prisma/databaseHealth.ts`）。WAL では、
 * 確定した書き込みがまだ `-wal` の中にしか無いことがあり、本体ファイルだけを写すと
 * 直近の書き込みが丸ごと落ちる。better-sqlite3 の `backup()` は SQLite のバックアップ
 * API を通るので、`-wal` の内容まで含んだ、その時点で一貫した写しを作る
 * （sqlite-nas-sync の README 制限事項 9）。写し先が既にあれば、中身はまるごと
 * 置き換わる（写し先の更新は1つのトランザクションで、途中で失敗しても半端に残らない）。
 *
 * 写し元は `openAppDatabase`（`PRAGMA recursive_triggers = ON`）で開く。失敗しても
 * 必ず閉じる。
 */
export async function backupDatabaseFile(
  sourcePath: string,
  destinationPath: string
): Promise<void> {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true })
  const source = openAppDatabase(sourcePath)
  try {
    await source.backup(destinationPath)
  } finally {
    source.close()
  }
}

/** 写した DB が壊れていないかを `PRAGMA quick_check` で確かめる。壊れていれば例外 */
export function assertDatabaseIntact(databasePath: string): void {
  const db = openAppDatabase(databasePath)
  try {
    const rows = db
      .prepare<[], { quick_check: string }>("PRAGMA quick_check")
      .all()
    const problems = rows
      .map((row) => row.quick_check)
      .filter((message) => message !== "ok")
    if (problems.length > 0) {
      throw new Error(
        `写した DB に不整合があります（${databasePath}）: ${problems.join(" / ")}`
      )
    }
  } finally {
    db.close()
  }
}
