/**
 * 旧版（同期の ON/OFF の版）から引き継ぐ
 *
 * 旧版は同期を ON にすると、userData の `score-at-once/database.db` に控えを作って
 * そこで作業していた。設定（`enabled` / `clientId` など）も userData の
 * `sync-config.json` にあった。新しい版はデータも設定も data に置くので、初めて
 * 起動したときに、**旧版が最後に作業していた DB** を `data/database.db` へ移し、
 * ローカルモードで起動する。
 *
 * 旧版で複数のPCが同期でつながっていた利用者はいない（本体は各PCにあり、同期フォルダは
 * 各PCの `data/sync` だった）。だから控えは、そのPCだけの正本である。
 *
 * **引き継ぐのは、旧版の設定が読めて `enabled: true` のときだけ。** それは旧版の
 * `getDatabasePath` が控えを返していた条件そのもので、つまり利用者が最後に作業して
 * いたのが控えだったことを意味する。設定が `enabled: false`・壊れている・無いとき、
 * 旧版は `data/database.db` を開いていた。そのとき控えが残っていても（削除に失敗した
 * 消し残り、または設定を手で書き換えた利用者のもの）、`data/database.db` のほうが
 * 後の作業を持っているので、控えで置き換えてはならない。その場合は何も触らない。
 *
 * 順序に意味がある。
 * 1. 控えを `backup()` で `data/database.db` へ写す（`fs.copyFileSync` は WAL を失う）
 * 2. 写した DB から同期の仕組みを取り除き（ライブラリの `removeSync`）、確かめる
 * 3. **旧版の設定を消す。** これが消えるまでは、次の起動でも引き継ぎがやり直される。
 *    控えは変わっていないので、やり直しは同じ結果になる（冪等）
 * 4. 控えを消す。失敗しても、設定が消えていれば二度と引き継がれないので、ただの消し残り
 *
 * 1〜3 のどれかで失敗したら、それ以上は進めずに知らせる。控えも旧版の設定も消さない。
 */

import * as fs from "fs"
import * as path from "path"

import { assertDatabaseIntact, backupDatabaseFile } from "./databaseCopy"
import { removeSyncMachinery } from "./syncInstanceFactory"

/** 旧版の設定ファイル（userData の直下） */
const LEGACY_CONFIG_FILE_NAME = "sync-config.json"
/** 旧版の控えのディレクトリ（userData の直下） */
const LEGACY_REPLICA_DIRECTORY_NAME = "score-at-once"

/** 引き継ぎの結果 */
export type LegacyMigrationOutcome =
  | { kind: "none" }
  | {
      kind: "migrated"
      /** 控えのディレクトリを消せなかった（ただの消し残り） */
      leftoverDirectory: string | null
    }
  | { kind: "failed"; message: string }

/** 旧版の設定が読めて、同期が入っていたか */
function wasLegacySyncEnabled(configPath: string): boolean {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    return (
      typeof raw === "object" &&
      raw !== null &&
      "enabled" in raw &&
      raw.enabled === true
    )
  } catch {
    return false
  }
}

/**
 * 旧版の控えがあれば `data/database.db` へ移す。
 *
 * @param userDataDirectory - Electron の userData
 * @param localDataDirectory - 実行ファイルの隣の data
 */
export async function migrateLegacyUserDataReplica({
  userDataDirectory,
  localDataDirectory,
}: {
  userDataDirectory: string
  localDataDirectory: string
}): Promise<LegacyMigrationOutcome> {
  const legacyConfigPath = path.join(userDataDirectory, LEGACY_CONFIG_FILE_NAME)
  const legacyReplicaDirectory = path.join(
    userDataDirectory,
    LEGACY_REPLICA_DIRECTORY_NAME
  )
  const legacyReplicaPath = path.join(legacyReplicaDirectory, "database.db")

  if (!fs.existsSync(legacyConfigPath)) return { kind: "none" }
  if (!wasLegacySyncEnabled(legacyConfigPath)) return { kind: "none" }
  if (!fs.existsSync(legacyReplicaPath)) {
    // 同期が入っていたのに控えが無い。持ってくるものが無いので、設定だけ片づける
    try {
      fs.rmSync(legacyConfigPath, { force: true })
    } catch (error) {
      console.warn(
        `Failed to remove legacy sync config: ${legacyConfigPath}`,
        error
      )
    }
    return { kind: "none" }
  }

  const destinationPath = path.join(localDataDirectory, "database.db")
  try {
    await backupDatabaseFile(legacyReplicaPath, destinationPath)
    // ローカルモードは同期と切り分けた世界なので、控えにあった同期の仕組みを残さない
    await removeSyncMachinery(destinationPath)
    assertDatabaseIntact(destinationPath)
  } catch (error) {
    return {
      kind: "failed",
      message:
        `以前の版で同期に使っていたデータ（${legacyReplicaPath}）を、` +
        `${destinationPath} へ移せませんでした。どちらのファイルも消していません。` +
        `\n${error instanceof Error ? error.message : String(error)}`,
    }
  }

  try {
    fs.rmSync(legacyConfigPath)
  } catch (error) {
    return {
      kind: "failed",
      message:
        `データは ${destinationPath} へ移しましたが、以前の版の設定（${legacyConfigPath}）を` +
        `消せませんでした。このままでは次の起動でも移し直します。` +
        `\n${error instanceof Error ? error.message : String(error)}`,
    }
  }

  try {
    fs.rmSync(legacyReplicaDirectory, { recursive: true, force: true })
    return { kind: "migrated", leftoverDirectory: null }
  } catch (error) {
    console.warn(
      `Failed to remove legacy replica directory: ${legacyReplicaDirectory}`,
      error
    )
    return { kind: "migrated", leftoverDirectory: legacyReplicaDirectory }
  }
}
