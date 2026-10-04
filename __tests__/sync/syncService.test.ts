/**
 * syncService のユニットテスト（共有モードで起動した場合）
 *
 * sqlite-nas-sync はモックする。見るのは、同期を始める・止める・間隔を変えるの流れと、
 * **共有フォルダが登録したときのものでなければ写しを置かない**こと。
 */
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_ROOT = path.join(os.tmpdir(), "score-at-once-sync-service-test")
const DATA_DIR = path.join(TEST_ROOT, "data")
const SHARED_FOLDER = path.join(TEST_ROOT, "shared")
const SHARED_ID = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d"

vi.mock("electron", () => ({
  app: { getPath: () => path.join(TEST_ROOT, "userData") },
  BrowserWindow: { getAllWindows: () => [] },
}))

vi.mock("../../electron-src/lib/dataManager", () => ({
  getLocalDataDirectory: () => DATA_DIR,
}))

// 監査ログ → prisma/client が読み込み時に接続を作るので、口だけ用意する
vi.mock("../../electron-src/lib/prisma/databaseInitializer", () => ({
  createSharedPrismaClient: () => ({}),
}))

const mockSyncNow = vi.fn().mockResolvedValue({
  clientsSynced: 0,
  warnings: [],
  skippedRemotes: [],
})
const mockStop = vi.fn()
const mockClose = vi.fn().mockResolvedValue(undefined)
const setupSyncCalls: Array<{
  dbPath: string
  nasPath: string
  intervalMs: number
}> = []

vi.mock("sqlite-nas-sync", () => ({
  setupSync: vi.fn(
    (config: { dbPath: string; nasPath: string; intervalMs: number }) => {
      setupSyncCalls.push(config)
      return {
        syncNow: mockSyncNow,
        start: vi.fn(),
        stop: mockStop,
        close: mockClose,
        on: vi.fn(),
      }
    }
  ),
}))

import {
  computeSharedRoots,
  fixStorageRoots,
} from "../../electron-src/lib/storageRoots"
import {
  getSharedReplicaDatabasePath,
  writeSharedFolderMarker,
} from "../../electron-src/lib/sync/sharedFolder"
import {
  loadSyncConfig,
  saveSyncConfig,
} from "../../electron-src/lib/sync/syncConfig"
import {
  getSyncStatus,
  initializeSync,
  stopSync,
  triggerSyncNow,
  updateSyncTiming,
} from "../../electron-src/lib/sync/syncService"
import { DEFAULT_SYNC_CONFIG } from "../../electron-src/lib/sync/types"

fixStorageRoots(
  computeSharedRoots(DATA_DIR, {
    sharedFolderId: SHARED_ID,
    sharedFolderPath: SHARED_FOLDER,
  })
)

beforeEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(SHARED_FOLDER, { recursive: true })
  saveSyncConfig({ ...DEFAULT_SYNC_CONFIG, clientId: "client-this-pc" })
  setupSyncCalls.length = 0
  mockSyncNow.mockClear()
  mockStop.mockClear()
  mockClose.mockClear()
})

afterEach(async () => {
  await stopSync()
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe("共有モードで起動したとき", () => {
  it("手元の控えと共有フォルダの sync で同期を始める", async () => {
    await initializeSync()
    expect(setupSyncCalls).toHaveLength(1)
    expect(setupSyncCalls[0].dbPath).toBe(
      getSharedReplicaDatabasePath(DATA_DIR, SHARED_ID)
    )
    expect(setupSyncCalls[0].nasPath).toBe(path.join(SHARED_FOLDER, "sync"))
    expect(getSyncStatus().state).toBe("idle")
  })

  it("識別ファイルが合えば同期する", async () => {
    writeSharedFolderMarker(SHARED_FOLDER, SHARED_ID)
    await initializeSync()
    await triggerSyncNow()
    expect(mockSyncNow).toHaveBeenCalledTimes(1)
  })

  it("共有フォルダが別のフォルダになっていたら、写しを置かずにエラーにする", async () => {
    writeSharedFolderMarker(
      SHARED_FOLDER,
      "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e"
    )
    await initializeSync()
    await expect(triggerSyncNow()).rejects.toThrow(/別の共有フォルダ/)
    expect(mockSyncNow).not.toHaveBeenCalled()
    expect(getSyncStatus().state).toBe("error")
  })

  it("共有フォルダに届かなければ、写しを置かずにエラーにする", async () => {
    fs.rmSync(SHARED_FOLDER, { recursive: true, force: true })
    await initializeSync()
    await expect(triggerSyncNow()).rejects.toThrow(/接続できない/)
    expect(mockSyncNow).not.toHaveBeenCalled()
  })

  it("間隔を変えると保存し、新しい間隔で始め直す", async () => {
    await initializeSync()
    await updateSyncTiming({ intervalMs: 45_000 })
    expect(loadSyncConfig().intervalMs).toBe(45_000)
    expect(setupSyncCalls.map((call) => call.intervalMs)).toEqual([
      DEFAULT_SYNC_CONFIG.intervalMs,
      45_000,
    ])
  })

  it("止めると setupSync が開いた接続を閉じる（アプリの終了時も stopSync を通る）", async () => {
    await initializeSync()
    await stopSync()
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it("間隔を変えて始め直すときは、前のインスタンスを閉じてから作る", async () => {
    await initializeSync()
    await updateSyncTiming({ intervalMs: 45_000 })
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it("止めたら手動の同期はできない", async () => {
    await initializeSync()
    await stopSync()
    await expect(triggerSyncNow()).rejects.toThrow(/同期が動いていません/)
  })
})
