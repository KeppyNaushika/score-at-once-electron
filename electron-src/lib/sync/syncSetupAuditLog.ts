/**
 * 共有モードの同意と、同期の設定の変更（共有フォルダの登録・起動先の変更・ローカルへの
 * 移行）の監査ログ。
 *
 * **DB の監査ログ（`AuditLog`）には書かない。** DB はローカルモードと共有プロファイルで
 * 別々なのに、これらはどちらの DB でもなく、このPCの設定（`sync-config.json`）への操作で
 * ある。どちらか一方の DB へ入れると、もう一方の世界からは見えなくなる。
 *
 * 書く先は2つ。どちらも追記だけで、1行が1件（JSON Lines）。
 *
 * - **このPC**: `data/sync-audit-log.jsonl`（設定ファイルの隣）。すべての出来事
 * - **共有フォルダ**: `<共有フォルダ>/audit/client-<clientId>.jsonl`。その共有フォルダに
 *   関わる出来事。他のPCからも、つないだ先生がそれぞれ同意したかを確かめられる。
 *   PCごとに別のファイルなので、PCどうしで書き合わない
 *
 * 記録は**証明ではない**（ただのファイルで、書き換えられる）。失敗しても主操作は止めない
 * （`recordAuditLog` と同じ）。
 */

import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"

import { getSharedFolderAuditDirectory } from "./sharedFolder"
import type { SharedFolderConnectAction } from "./storageModeService"
import type { StorageMode, SyncConsent } from "./types"

/** このPCの記録のファイル名（data の直下） */
const LOCAL_AUDIT_LOG_FILE_NAME = "sync-audit-log.jsonl"

/** 記録する出来事 */
export type SyncSetupAuditEvent =
  /** 共有モードの注意事項に同意した */
  | { kind: "consent"; consentVersion: string }
  /** 共有フォルダを登録し、次の起動でそのプロファイルを使うようにした */
  | {
      kind: "connect-shared-folder"
      action: SharedFolderConnectAction
      /** 登録済みの共有フォルダを、別のパスで登録し直しただけか */
      reregistered: boolean
      sharedFolderId: string
      sharedFolderPath: string
      /** 登録したときの同意。共有フォルダの記録だけで、同意したかを確かめられるように持つ */
      consent: SyncConsent | null
    }
  /** 次の起動で使うモード・プロファイルを選んだ */
  | {
      kind: "select-startup-storage"
      mode: StorageMode
      sharedFolderId: string | null
    }
  /** 共有プロファイルのデータを、空のローカルモードへ移した */
  | { kind: "migrate-profile-to-local"; sharedFolderId: string }

/** 記録の1件 */
export interface SyncSetupAuditEntry {
  /** uuidv4 */
  id: string
  /** ISO 8601 */
  recordedAt: string
  /**
   * 操作した人。**動いていた DB の利用者**なので、id はその DB の中でしか意味を持たない
   * （ローカルモードの利用者と共有の利用者は別物）。そのため氏名もその時の値で残す。
   * ログインしていない・分からないときは null
   */
  actor: { userId: string; userName: string | null } | null
  /** 操作したとき動いていたモードと、共有モードならそのプロファイル */
  runningMode: StorageMode
  runningSharedFolderId: string | null
  /** このPCの clientId とホスト名。data ごと別のPCへ写しても、どのPCの出来事か分かる */
  clientId: string
  hostname: string
  event: SyncSetupAuditEvent
}

/** このPCの記録のパス */
export function getLocalSyncAuditLogPath(localDataDirectory: string): string {
  return path.join(localDataDirectory, LOCAL_AUDIT_LOG_FILE_NAME)
}

/** 共有フォルダの、このPCの記録のパス */
export function getSharedSyncAuditLogPath(
  sharedFolderPath: string,
  clientId: string
): string {
  return path.join(
    getSharedFolderAuditDirectory(sharedFolderPath),
    `client-${clientId}.jsonl`
  )
}

/** 記録の1件を作る（id と日時はここで付ける） */
export function createSyncSetupAuditEntry(
  entry: Omit<SyncSetupAuditEntry, "id" | "recordedAt">,
  now: Date = new Date()
): SyncSetupAuditEntry {
  return { id: crypto.randomUUID(), recordedAt: now.toISOString(), ...entry }
}

function appendLine(filePath: string, entry: SyncSetupAuditEntry): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, "utf-8")
  } catch (error) {
    // ベストエフォート: 記録できなくても主操作は壊さない
    console.error(`Failed to append sync audit log: ${filePath}`, error)
  }
}

/**
 * 記録の1件を書く。このPCの記録には必ず、共有フォルダが分かればそちらにも書く。
 *
 * @param sharedFolderPath - 出来事が関わる共有フォルダ。無ければ（ローカルモードを選んだ等）null
 */
export function appendSyncSetupAuditEntry(
  entry: SyncSetupAuditEntry,
  {
    localDataDirectory,
    sharedFolderPath,
  }: { localDataDirectory: string; sharedFolderPath: string | null }
): void {
  appendLine(getLocalSyncAuditLogPath(localDataDirectory), entry)
  if (sharedFolderPath !== null) {
    appendLine(
      getSharedSyncAuditLogPath(sharedFolderPath, entry.clientId),
      entry
    )
  }
}
