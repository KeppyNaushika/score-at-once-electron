/**
 * syncService のユニットテスト
 *
 * ensureLocalDb / cleanupLocalDb / updateSyncConfig のテスト。
 * sqlite-nas-syncのsetupSyncはモック化し、DB操作のロジックを検証する。
 */

import * as fs from "fs"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DATA_DIR = path.join("/tmp", `sync-svc-data-${Date.now()}`)
const TEST_LOCAL_DIR = path.join("/tmp", `sync-svc-local-${Date.now()}`)

// electronモック
vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => {
      if (name === "userData") return TEST_LOCAL_DIR
      return "/tmp/test"
    },
  },
  BrowserWindow: {
    getAllWindows: () => [],
  },
}))

// dataManagerモック
vi.mock("../../electron-src/lib/dataManager", () => ({
  getDataDirectory: () => TEST_DATA_DIR,
}))

// sqlite-nas-syncモック
const mockSyncNow = vi.fn().mockResolvedValue({
  clientsSynced: 0,
  inserted: 0,
  updated: 0,
  deleted: 0,
  skipped: 0,
  conflictsResolved: 0,
  warnings: [],
})
const mockStart = vi.fn()
const mockStop = vi.fn()
const mockOn = vi.fn()

vi.mock("sqlite-nas-sync", () => ({
  setupSync: vi.fn(() => ({
    syncNow: mockSyncNow,
    start: mockStart,
    stop: mockStop,
    on: mockOn,
    getStatus: () => ({
      isSyncing: false,
      lastSyncedAt: null,
      lastResult: null,
      isRunning: false,
    }),
  })),
}))

// databaseInitializerモック
vi.mock("../../electron-src/lib/prisma/databaseInitializer", () => ({
  getDatabasePath: () =>
    path.join(TEST_LOCAL_DIR, "score-at-once", "database.db"),
}))

import {
  getLocalDbDirectory,
  getLocalDbPath,
  getNasDbPath,
  getNasSyncPath,
  loadSyncConfig,
  saveSyncConfig,
} from "../../electron-src/lib/sync/syncConfig"
import {
  getSyncStatus,
  initializeSync,
  startSync,
  stopSync,
  triggerSyncNow,
  updateSyncConfig,
} from "../../electron-src/lib/sync/syncService"
import { DEFAULT_SYNC_CONFIG } from "../../electron-src/lib/sync/types"

describe("syncService", () => {
  beforeEach(() => {
    // テスト用ディレクトリ作成
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true })
    fs.mkdirSync(TEST_LOCAL_DIR, { recursive: true })

    // NAS上にダミーDBを作成
    const nasDbPath = getNasDbPath()
    fs.writeFileSync(nasDbPath, "NAS-DB-CONTENT", "utf-8")

    // モックリセット
    mockSyncNow.mockClear()
    mockStart.mockClear()
    mockStop.mockClear()
    mockOn.mockClear()

    // sync設定をリセット
    saveSyncConfig(DEFAULT_SYNC_CONFIG)
  })

  afterEach(async () => {
    await stopSync()
    for (const dir of [TEST_DATA_DIR, TEST_LOCAL_DIR]) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  describe("ensureLocalDb（startSync経由）", () => {
    it("sync開始時にNAS DBがローカルにコピーされる", async () => {
      const config = {
        ...DEFAULT_SYNC_CONFIG,
        enabled: true,
        clientId: "test-client",
      }
      saveSyncConfig(config)

      await startSync(config)

      const localDbPath = getLocalDbPath()
      expect(fs.existsSync(localDbPath)).toBe(true)

      const content = fs.readFileSync(localDbPath, "utf-8")
      expect(content).toBe("NAS-DB-CONTENT")
    })

    it("ローカルDBが既に存在する場合は上書きしない", async () => {
      // ローカルDBを先に作成
      const localDir = getLocalDbDirectory()
      fs.mkdirSync(localDir, { recursive: true })
      const localDbPath = getLocalDbPath()
      fs.writeFileSync(localDbPath, "LOCAL-EXISTING-CONTENT", "utf-8")

      const config = {
        ...DEFAULT_SYNC_CONFIG,
        enabled: true,
        clientId: "test-client",
      }
      saveSyncConfig(config)

      await startSync(config)

      const content = fs.readFileSync(localDbPath, "utf-8")
      expect(content).toBe("LOCAL-EXISTING-CONTENT")
    })

    it("NAS DBが存在しない場合もエラーにならない", async () => {
      // NAS DBを削除
      const nasDbPath = getNasDbPath()
      fs.unlinkSync(nasDbPath)

      const config = {
        ...DEFAULT_SYNC_CONFIG,
        enabled: true,
        clientId: "test-client",
      }

      await expect(startSync(config)).resolves.not.toThrow()

      // ローカルDBは作成されない（コピー元がない）
      const localDbPath = getLocalDbPath()
      expect(fs.existsSync(localDbPath)).toBe(false)
    })

    it("syncディレクトリが自動作成される", async () => {
      const config = {
        ...DEFAULT_SYNC_CONFIG,
        enabled: true,
        clientId: "test-client",
      }

      await startSync(config)

      const syncPath = getNasSyncPath()
      expect(fs.existsSync(syncPath)).toBe(true)
    })
  })

  describe("cleanupLocalDb（updateSyncConfig経由）", () => {
    it("sync無効化時にローカルDBがNASに書き戻される", async () => {
      // sync有効状態をセットアップ
      const config = {
        ...DEFAULT_SYNC_CONFIG,
        enabled: true,
        clientId: "test-client",
      }
      saveSyncConfig(config)
      await startSync(config)

      // ローカルDBの内容を変更（採点作業をシミュレート）
      const localDbPath = getLocalDbPath()
      fs.writeFileSync(localDbPath, "LOCAL-MODIFIED-CONTENT", "utf-8")

      // sync無効化
      await updateSyncConfig({ enabled: false })

      // NAS DBにローカルの内容が書き戻されている
      const nasDbPath = getNasDbPath()
      const nasContent = fs.readFileSync(nasDbPath, "utf-8")
      expect(nasContent).toBe("LOCAL-MODIFIED-CONTENT")
    })

    it("sync無効化時にローカルDBディレクトリが削除される", async () => {
      const config = {
        ...DEFAULT_SYNC_CONFIG,
        enabled: true,
        clientId: "test-client",
      }
      saveSyncConfig(config)
      await startSync(config)

      const localDir = getLocalDbDirectory()
      expect(fs.existsSync(localDir)).toBe(true)

      await updateSyncConfig({ enabled: false })

      expect(fs.existsSync(localDir)).toBe(false)
    })

    it("ローカルDBが存在しない場合もエラーにならない", async () => {
      const config = {
        ...DEFAULT_SYNC_CONFIG,
        enabled: true,
        clientId: "test-client",
      }
      saveSyncConfig(config)

      // ローカルDBを作成せずに無効化
      await expect(updateSyncConfig({ enabled: false })).resolves.not.toThrow()
    })
  })

  describe("initializeSync", () => {
    it("sync無効時は何もしない", async () => {
      saveSyncConfig({ ...DEFAULT_SYNC_CONFIG, enabled: false })

      await initializeSync()

      const status = getSyncStatus()
      expect(status.state).toBe("disabled")
      expect(mockStart).not.toHaveBeenCalled()
    })

    it("sync有効時はsyncを開始する", async () => {
      saveSyncConfig({
        ...DEFAULT_SYNC_CONFIG,
        enabled: true,
        clientId: "test-client",
      })

      await initializeSync()

      expect(mockStart).toHaveBeenCalled()
      const status = getSyncStatus()
      expect(status.state).toBe("idle")
    })
  })

  describe("triggerSyncNow", () => {
    it("sync未開始時はエラーを投げる", async () => {
      await expect(triggerSyncNow()).rejects.toThrow(
        "同期が有効になっていません"
      )
    })

    it("sync開始後は手動syncを実行できる", async () => {
      const config = {
        ...DEFAULT_SYNC_CONFIG,
        enabled: true,
        clientId: "test-client",
      }
      saveSyncConfig(config)
      await startSync(config)

      const result = await triggerSyncNow()
      expect(result).toBeDefined()
      expect(mockSyncNow).toHaveBeenCalled()
    })
  })

  describe("updateSyncConfig", () => {
    it("interval変更時はsyncを再起動する", async () => {
      const config = {
        ...DEFAULT_SYNC_CONFIG,
        enabled: true,
        clientId: "test-client",
      }
      saveSyncConfig(config)
      await startSync(config)

      mockStart.mockClear()
      await updateSyncConfig({ intervalMs: 60000 })

      // 設定が保存されている
      const loaded = loadSyncConfig()
      expect(loaded.intervalMs).toBe(60000)

      // syncが再起動された
      expect(mockStart).toHaveBeenCalled()
    })

    it("設定変更が永続化される", async () => {
      saveSyncConfig({
        ...DEFAULT_SYNC_CONFIG,
        clientId: "test-client",
      })

      await updateSyncConfig({ changelogRetentionDays: 14 })

      const loaded = loadSyncConfig()
      expect(loaded.changelogRetentionDays).toBe(14)
    })
  })

  describe("getSyncStatus", () => {
    it("初期状態はdisabled", () => {
      const status = getSyncStatus()
      expect(status.state).toBe("disabled")
      expect(status.lastSyncTime).toBeNull()
      expect(status.syncCount).toBe(0)
    })
  })
})
