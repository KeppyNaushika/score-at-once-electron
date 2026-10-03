/**
 * 同期で使うローカルDB（このPCの控え）の用意・書き戻し・後片付け。
 *
 * 同期を入れるとアプリはローカルDBを使い、切るとNAS上のDBへ戻る。その切り替えで
 * DB ファイルを写す・消す手順をここに置く。
 */

import * as fs from "fs"

import { getDataDirectory } from "../dataManager"
import { openAppDatabase } from "../prisma/sqliteConnection"
import { getLocalDbDirectory, getLocalDbPath, getNasDbPath } from "./syncConfig"

/**
 * DB ファイルを丸ごと写す。**`fs.copyFileSync` を使ってはならない。**
 *
 * このアプリの DB は WAL モードで開く（`../prisma/databaseHealth.ts`）。WAL では、
 * 確定した書き込みがまだ `-wal` の中にしか無いことがあり、本体ファイルだけを写すと
 * 直近の書き込みが丸ごと落ちる。しかも写した直後に控えを消すので、取り戻せない。
 * better-sqlite3 の `backup()` は SQLite のバックアップ API を通るので、`-wal` の
 * 内容まで含んだ、その時点で一貫した写しを作る（ライブラリの README 制限事項 9）。
 *
 * 写し元は `openAppDatabase`（`PRAGMA recursive_triggers = ON`）で開く。失敗しても
 * 必ず閉じる。
 */
async function backupDatabaseFile(
  sourcePath: string,
  destinationPath: string
): Promise<void> {
  const source = openAppDatabase(sourcePath)
  try {
    await source.backup(destinationPath)
  } finally {
    source.close()
  }
}

/**
 * ローカルDBを準備する（sync有効化時）
 *
 * ローカルDBが存在しない場合、NAS上のDBを写して初期化する。
 */
export async function ensureLocalDb(): Promise<void> {
  const localDir = getLocalDbDirectory()
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true })
  }

  const localDbPath = getLocalDbPath()
  if (!fs.existsSync(localDbPath)) {
    const nasDbPath = getNasDbPath()
    if (fs.existsSync(nasDbPath)) {
      console.log(`Copying NAS DB to local: ${nasDbPath} → ${localDbPath}`)
      await backupDatabaseFile(nasDbPath, localDbPath)
    }
  }
}

/**
 * ローカルDBの内容をNAS側へ書き戻す（sync無効化時）。
 *
 * **ここが失敗したら同期を切ってはならない。** 切るのをやめればローカルDBはそのまま
 * 残るので、何も失われない。呼び出し側は例外をそのまま上へ投げること。
 *
 * @returns 書き戻した（ローカルDBがあった）なら true
 */
export async function writeBackLocalDb(): Promise<boolean> {
  const localDbPath = getLocalDbPath()
  if (!fs.existsSync(localDbPath)) return false

  const nasDbPath = getNasDbPath()
  const nasDir = getDataDirectory()
  if (!fs.existsSync(nasDir)) {
    fs.mkdirSync(nasDir, { recursive: true })
  }
  console.log(`Writing back local DB to NAS: ${localDbPath} → ${nasDbPath}`)
  await backupDatabaseFile(localDbPath, nasDbPath)
  return true
}

/**
 * ローカルDBの控えを消す。
 *
 * **失敗しても致命的ではない。** 書き戻しは済んでいて、設定も保存済みなので、消し残りは
 * ただのゴミである。ここで例外を投げると、同期を切れたのに切れなかったことになる
 * （issue #1270）。消し残りは次の起動時の `initializeSync` が拾う。
 *
 * @returns 消せたなら true
 */
export function removeLocalDbDirectory(): boolean {
  const localDir = getLocalDbDirectory()
  if (!fs.existsSync(localDir)) return true
  try {
    fs.rmSync(localDir, { recursive: true, force: true })
    console.log(`Removed local DB directory: ${localDir}`)
    return true
  } catch (error) {
    console.warn(`Failed to remove local DB directory: ${localDir}`, error)
    return false
  }
}
