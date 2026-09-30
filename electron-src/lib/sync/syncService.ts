/**
 * NAS同期サービス
 *
 * sqlite-nas-syncのSyncInstanceをラップし、
 * アプリライフサイクルとIPC通信を管理する。
 *
 * sync有効時はローカルDBを使用し、NAS経由で他PCと同期する。
 * sync無効時はNAS上のDBを直接使用する（従来動作）。
 *
 * 削除の伝搬はライブラリの `_tombstone`（削除の版）に一本化している。
 * 時刻を見ずに id を消し続けるアプリ側の削除記録は持たない（issue #918）。
 *
 * v0.20.0 から、ライブラリはアプリの表を**行の版から作り直す**。別id・同一ユニークキーで
 * かぶった行は1つへ畳まれず、弱い方が隠れるだけになった（事実は残り、重なりが解ければ戻る。
 * ただし v0.21.0 から、表示している方を削除すると隠れている方にも削除が書かれる）。
 * 旧方式のローカルDB（`_changelog` / `_tombstone` / `_id_merge` を持つもの）は、
 * `setupSync` の最初の1回でライブラリが移行するので、アプリ側の移行処理は要らない。
 *
 * **アプリの表を書く接続はすべて `PRAGMA recursive_triggers = ON` で開くこと**
 * （`../prisma/sqliteConnection.ts`）。ライブラリの接続はライブラリが自分で立てる。
 */

import { BrowserWindow } from "electron"
import * as fs from "fs"
import type { SyncInstance, SyncResult } from "sqlite-nas-sync"

import { syncTableLabel } from "@/lib/shared/syncTableLabels"

import { getDataDirectory } from "../dataManager"
import type { AuditActionKey } from "../prisma/auditActions"
import { recordAuditLog } from "../prisma/auditLog"
import { openAppDatabase } from "../prisma/sqliteConnection"
import { getSchemaVersion } from "./schemaVersion"
import {
  ensureClientId,
  ensureSyncDirectory,
  getLocalDbDirectory,
  getLocalDbPath,
  getNasDbPath,
  getNasSyncPath,
  loadSyncConfig,
  saveSyncConfig,
} from "./syncConfig"
import { SYNC_EXCLUDE_TABLES, SYNC_TABLE_OPTIONS } from "./syncTableConfig"
import type {
  SyncAppConfig,
  SyncAppStatus,
  SyncParentDeletedReport,
  SyncRecordFold,
  SyncRecordFoldReport,
  SyncWarningReport,
  VersionMismatchRemote,
} from "./types"

/**
 * SyncResultからバージョン不一致リモートの一覧を抽出する。
 *
 * 両方の版は、こちらが `setupSync` に渡したアプリの版（マイグレーション名）そのもので
 * 届く。v0.20.0 はライブラリの内部の印（`;sns-format=rows1`）が付いたまま返していたが、
 * v0.21.0 で外された。マイグレーション名はタイムスタンプ接頭辞なので辞書順で比べられる。
 *
 * ここに出るのは**アプリの版が違う相手だけ**である。ライブラリの内部形式（`sns-format`）が
 * 違う相手も見送られるが、v0.20.0 と v0.21.0 の形式はどちらも `rows1` なので、
 * アプリの版が同じならライブラリの版が違っても見送られない（＝混ざって同期する）。
 * ライブラリを上げる版は全PCへ同時に配ること。
 */
function extractVersionMismatches(result: SyncResult): VersionMismatchRemote[] {
  return result.skippedRemotes.map((skippedRemote) => ({
    clientId: skippedRemote.clientId,
    remoteVersion: skippedRemote.remoteVersion,
    remoteIsNewer:
      skippedRemote.remoteVersion !== null &&
      skippedRemote.remoteVersion > skippedRemote.localVersion,
  }))
}

let syncInstance: SyncInstance | null = null

let currentStatus: SyncAppStatus = {
  state: "disabled",
  lastSyncTime: null,
  lastError: null,
  syncCount: 0,
  versionMismatches: [],
  lastWarnings: [],
}

/**
 * 前回の同期が出した注意書き。**新しく出たものだけ**をトーストにするために持つ。
 *
 * 同じ注意は、原因が続くかぎり同期のたびに出る。毎回トーストにすると、同期間隔ごとに
 * 同じ窓が積み上がって、他の知らせを覆ってしまう。直近1回ぶんの全文は
 * `currentStatus.lastWarnings` にあるので、ここで落としても設定画面から読める。
 */
let previousWarnings: string[] = []

function updateStatus(partial: Partial<SyncAppStatus>): void {
  currentStatus = { ...currentStatus, ...partial }
  broadcastSyncStatus()
}

function broadcastSyncStatus(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send("sync:status-changed", currentStatus)
    } catch {
      // ウィンドウが既に閉じられている場合は無視
    }
  }
}

/**
 * この回に**新しく出た**注意書きを renderer へ押し出す。
 *
 * ライブラリの `SyncResult.warnings` は「アプリケーションの利用者に見える場所へ出す」
 * ものだが、トーストだけに載せると流れて消える。消えない一覧は `SyncAppStatus` に
 * 載せてあるので、ここは**気づかせるためだけ**の押し出しで、取りこぼしても構わない。
 *
 * 中身は加工しない（利用者向けの言い換えは renderer 側で行う）。
 */
function broadcastSyncWarnings(report: SyncWarningReport): void {
  if (report.newWarnings.length === 0) return
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send("sync:warnings-changed", report)
    } catch {
      // ウィンドウが既に閉じられている場合は無視
    }
  }
}

/**
 * かぶった行の見え方が変わった（隠れた・表示に戻った）ことを renderer へ押し出す。
 *
 * **既読は持たない。** 同期はアプリが動いている間しか走らないので、変わった瞬間には
 * 必ず窓が開いている。読んだかどうかを覚えると、その状態がまた新しい保存先になる。
 * あとから見返す口は監査ログ（`sync.duplicate.hide` / `sync.duplicate.restore`）に寄せる。
 *
 * 中身は加工しない（何件が何になったかの数え上げは renderer 側で組み立てる）。
 */
function broadcastRecordFolds(report: SyncRecordFoldReport): void {
  if (report.folds.length === 0 && report.restores.length === 0) return
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send("sync:record-folds-changed", report)
    } catch {
      // ウィンドウが既に閉じられている場合は無視
    }
  }
}

/**
 * 親が他のPCで削除されたために表から外れた行・親が作り直されて戻った行を renderer へ
 * 押し出す。
 *
 * `broadcastRecordFolds` と同じく**既読は持たない**が、こちらは取りこぼしても事実は
 * 失われない（ライブラリの内部表 `_sns_unplaceable` に残っていて、外れたままの行は
 * 次の回でもう一度は出ないだけ）。
 *
 * 中身は加工しない（テーブルごとの数え上げは renderer 側で組み立てる）。
 */
function broadcastParentDeleted(report: SyncParentDeletedReport): void {
  if (report.parentDeleted.length === 0 && report.parentReturned.length === 0)
    return
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send("sync:parent-deleted-changed", report)
    } catch {
      // ウィンドウが既に閉じられている場合は無視
    }
  }
}

/**
 * 隠れた行と表示に戻った行を監査ログへ残す（あとから見返す口はここ1つ。専用の
 * 履歴画面は作らない）。
 *
 * v0.19.0 までの `sync.merge`（行を消して1つにまとめた）とは**別の action** にする。
 * 今は何も消えないので、同じ名前で書くと、過去の「消した」記録と今の「隠した」記録が
 * 監査ログの上で見分けられなくなる。
 *
 * `coalesceKey` は**同じ端末が同じ出来事を二度書くのを止めるだけ**で、端末をまたいだ
 * 重複は畳めない。隠れる・戻るは各端末の作り直しでそれぞれ起きるが、相手の記録が届くのは
 * 相手が書いた次の同期以降で、書く時点のローカルDBにはまだ無い（`recordAuditLog` の
 * 突き合わせは書く瞬間のローカル行に対してしか働かない）。端末数ぶん行が並ぶのはそのため。
 */
async function recordFoldAuditLogs(
  report: SyncRecordFoldReport
): Promise<void> {
  for (const fold of report.folds) {
    await recordFoldAuditLog("sync.duplicate.hide", fold)
  }
  for (const fold of report.restores) {
    await recordFoldAuditLog("sync.duplicate.restore", fold)
  }
}

/** 隠れた（または表示に戻った）行1つを監査ログへ書く。対象はその行（`losingId`） */
async function recordFoldAuditLog(
  action: AuditActionKey,
  fold: SyncRecordFold
): Promise<void> {
  await recordAuditLog({
    action,
    // システム操作は null（利用者が起こした操作ではない）
    userId: null,
    entityType: fold.tableName,
    entityId: fold.losingId,
    target: syncTableLabel(fold.tableName),
    extra: {
      losingId: fold.losingId,
      winningId: fold.winningId,
    },
    coalesceKey: `${action}:${fold.tableName}:${fold.losingId}`,
  })
}

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
async function ensureLocalDb(): Promise<void> {
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
async function writeBackLocalDb(): Promise<boolean> {
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
function removeLocalDbDirectory(): boolean {
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

/**
 * アプリ起動時の初期化。設定が有効ならsyncを開始する。
 *
 * **起動時にローカルDBの控えを消してはならない。** 消し残りを掃除したくなるが、
 * `config.enabled === false` は「書き戻しが終わった」証拠にならない。
 * `loadSyncConfig()` は `sync-config.json` が無いときも、JSON として壊れているときも、
 * 例外を握りつぶして既定値（`enabled: false`）を返す。設定ファイルが消える・壊れるだけで
 * 起動時の掃除が走り、書き戻しを一度もしていないローカルDBを消すことになる。
 * 同期を切れなくなった利用者が設定ファイルを手で書き換えて回避する経路も同じで、
 * そのローカルDBは正本である。どちらも「ゴミ」ではなく唯一のデータなので、消さない。
 *
 * 消し残りはディスクを使うだけで害が無く、`updateSyncConfig` の正常な経路では既に
 * 消えている。積極的な証拠（「まだ消していない」という印）を設定ファイルへ持たせる案も
 * あるが、その印もまた設定ファイルが壊れれば失われ、守られる利益が消し残りのディスク
 * だけなので、印は持たずに掃除そのものを行わない。
 */
export async function initializeSync(): Promise<void> {
  let config = loadSyncConfig()
  config = ensureClientId(config)

  if (!config.enabled) {
    updateStatus({ state: "disabled" })
    return
  }

  try {
    await startSync(config)
  } catch (error) {
    console.error("Failed to initialize sync:", error)
    updateStatus({
      state: "error",
      lastError: error instanceof Error ? error.message : String(error),
    })
  }
}

/** syncを開始する */
export async function startSync(config: SyncAppConfig): Promise<void> {
  await stopSync()

  // ローカルDBを準備
  await ensureLocalDb()

  const dbPath = getLocalDbPath()
  const nasPath = getNasSyncPath()
  ensureSyncDirectory()

  const { setupSync } = await import("sqlite-nas-sync")

  syncInstance = setupSync({
    dbPath,
    nasPath,
    clientId: config.clientId,
    excludeTables: SYNC_EXCLUDE_TABLES,
    tableOptions: SYNC_TABLE_OPTIONS,
    intervalMs: config.intervalMs,
    changelogRetentionDays: config.changelogRetentionDays,
    schemaVersion: getSchemaVersion(),
    onAfterSync: (_localDb, result) => {
      updateStatus({
        state: "idle",
        lastSyncTime: new Date().toISOString(),
        lastError: null,
        syncCount: currentStatus.syncCount + 1,
        versionMismatches: extractVersionMismatches(result),
        lastWarnings: result.warnings,
      })

      // 注意書きは、原因が続くかぎり毎回出る。気づかせるのは新しく出た回だけにして、
      // 全文は設定画面（消えない一覧）へ回す
      const newWarnings = result.warnings.filter(
        (warning) => !previousWarnings.includes(warning)
      )
      previousWarnings = result.warnings
      broadcastSyncWarnings({ newWarnings })

      // 隠れた行は画面から黙って1つ消えたように見え、戻った行は消したはずのものが
      // 現れたように見える。どちらも起きた瞬間に伝える。
      const foldReport: SyncRecordFoldReport = {
        folds: result.folds,
        restores: result.restores,
      }
      broadcastRecordFolds(foldReport)
      // 記録はベストエフォート（`recordAuditLog` は失敗を握りつぶす）。同期の
      // コールバックは同期関数なので、書き込みの完了は待たずに切り離す。
      void recordFoldAuditLogs(foldReport)

      // 親を他のPCで消されて表から外れた行も、画面からは黙って消えたように見える。
      broadcastParentDeleted({
        parentDeleted: result.parentDeleted,
        parentReturned: result.parentReturned,
      })
    },
  })

  syncInstance.on("sync:start", () => {
    updateStatus({ state: "syncing" })
  })

  syncInstance.on("sync:error", (error) => {
    updateStatus({
      state: "error",
      lastError: error instanceof Error ? error.message : String(error),
    })
  })

  syncInstance.start()
  updateStatus({ state: "idle", lastError: null })
}

/** syncを停止する */
export async function stopSync(): Promise<void> {
  if (syncInstance) {
    syncInstance.stop()
    syncInstance = null
  }
  // 止めた時点の注意は、次に始めたときには古い。新しく出た扱いでもう一度知らせる
  previousWarnings = []
  updateStatus({ state: "disabled", lastWarnings: [] })
}

/** 手動sync実行 */
export async function triggerSyncNow(): Promise<SyncResult> {
  if (!syncInstance) {
    throw new Error("同期が有効になっていません")
  }
  return syncInstance.syncNow()
}

/** 現在のステータスを取得 */
export function getSyncStatus(): SyncAppStatus {
  return { ...currentStatus }
}

/** 設定を更新してsyncを再起動 */
export async function updateSyncConfig(
  partial: Partial<SyncAppConfig>
): Promise<void> {
  const current = loadSyncConfig()
  const updated = { ...current, ...partial }

  // sync無効化時: 最後の同期 → 停止 → 書き戻し → 設定保存 → 控えの削除
  //
  // **順序に意味がある。**
  // - 最後の同期は `stopSync()` の**前**でなければ走らない（止めると `syncInstance` が
  //   消える）。上げるだけでなく取り込みもするので、切る前に1回やる値打ちがある。
  //   ただし、ここで上げた内容を他のPCが受け取るのは、そのPCの次の同期のときである
  // - 書き戻しに失敗したら**設定を変えずに投げる**。ローカルDBは残るので何も失われず、
  //   同期が入ったままなのが正しい
  // - 設定の保存は**削除より前**。順序が逆だと、削除の失敗で設定が保存されず、
  //   二度と同期を切れなくなる（issue #1270）
  if (current.enabled && !updated.enabled) {
    try {
      if (syncInstance) {
        await syncInstance.syncNow()
      }
    } catch {
      // 最終syncに失敗しても、切る処理は続行する
    }

    await stopSync()

    await writeBackLocalDb()

    saveSyncConfig(updated)

    removeLocalDbDirectory()

    return
  }

  saveSyncConfig(updated)

  if (updated.enabled) {
    await startSync(updated)
  } else if (!current.enabled) {
    // 既に無効で、設定変更のみ（interval等）
    await stopSync()
  }
}
