/**
 * 共有モードの同意と同期の設定の変更の監査ログ（`syncSetupAuditLog.ts`）。
 *
 * ここで固定するのは次の3つ:
 *
 * - **このPCの記録には必ず書く。** 共有フォルダが関わる出来事は、共有フォルダの
 *   PCごとのファイルにも同じ1件を書く（他のPCから、つないだ先生が同意したかを確かめられる）
 * - **追記だけ。** 前の記録を書き換えない
 * - **共有フォルダに書けなくても、このPCの記録は残り、例外を投げない**（主操作を止めない）
 */
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  appendSyncSetupAuditEntry,
  createSyncSetupAuditEntry,
  getLocalSyncAuditLogPath,
  getSharedSyncAuditLogPath,
  type SyncSetupAuditEntry,
} from "../../electron-src/lib/sync/syncSetupAuditLog"

const ROOT = path.join(os.tmpdir(), "score-at-once-sync-setup-audit-test")
const DATA_DIR = path.join(ROOT, "data")
const SHARED_DIR = path.join(ROOT, "share")
const CLIENT_ID = "6c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d4e5"

beforeEach(() => {
  fs.rmSync(ROOT, { recursive: true, force: true })
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(SHARED_DIR, { recursive: true })
})
afterEach(() => {
  fs.rmSync(ROOT, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function consentEntry(): SyncSetupAuditEntry {
  return createSyncSetupAuditEntry({
    actor: { userId: "user-1", userName: "採点 太郎" },
    runningMode: "local",
    runningSharedFolderId: null,
    clientId: CLIENT_ID,
    hostname: "pc-1",
    event: { kind: "consent", consentVersion: "2026-10-16" },
  })
}

const readLines = (filePath: string): unknown[] =>
  fs
    .readFileSync(filePath, "utf-8")
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line) as unknown)

describe("同期の設定の監査ログ", () => {
  it("共有フォルダが関わらない出来事は、このPCの記録にだけ書く", () => {
    const entry = consentEntry()
    appendSyncSetupAuditEntry(entry, {
      localDataDirectory: DATA_DIR,
      sharedFolderPath: null,
    })

    expect(readLines(getLocalSyncAuditLogPath(DATA_DIR))).toEqual([entry])
    expect(fs.existsSync(path.join(SHARED_DIR, "audit"))).toBe(false)
  })

  it("共有フォルダが関わる出来事は、共有フォルダのこのPCのファイルにも同じ1件を書く", () => {
    const entry = consentEntry()
    appendSyncSetupAuditEntry(entry, {
      localDataDirectory: DATA_DIR,
      sharedFolderPath: SHARED_DIR,
    })

    expect(readLines(getSharedSyncAuditLogPath(SHARED_DIR, CLIENT_ID))).toEqual(
      [entry]
    )
    expect(getSharedSyncAuditLogPath(SHARED_DIR, CLIENT_ID)).toBe(
      path.join(SHARED_DIR, "audit", `client-${CLIENT_ID}.jsonl`)
    )
  })

  it("追記するだけで、前の記録を書き換えない", () => {
    const first = consentEntry()
    const second = consentEntry()
    const target = { localDataDirectory: DATA_DIR, sharedFolderPath: null }
    appendSyncSetupAuditEntry(first, target)
    appendSyncSetupAuditEntry(second, target)

    expect(readLines(getLocalSyncAuditLogPath(DATA_DIR))).toEqual([
      first,
      second,
    ])
    expect(first.id).not.toBe(second.id)
  })

  it("共有フォルダに書けなくても、このPCの記録は残り、例外を投げない", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    // 共有フォルダの audit の場所にファイルがあると、ディレクトリを作れない
    fs.writeFileSync(path.join(SHARED_DIR, "audit"), "")
    const entry = consentEntry()

    expect(() =>
      appendSyncSetupAuditEntry(entry, {
        localDataDirectory: DATA_DIR,
        sharedFolderPath: SHARED_DIR,
      })
    ).not.toThrow()
    expect(readLines(getLocalSyncAuditLogPath(DATA_DIR))).toEqual([entry])
  })
})
