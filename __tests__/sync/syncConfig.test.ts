/**
 * syncConfig のユニットテスト
 */

import * as fs from "fs"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// テスト用ディレクトリ
const TEST_DATA_DIR = path.join("/tmp", `sync-test-${Date.now()}`)
const TEST_USER_DATA_DIR = path.join("/tmp", `sync-test-userdata-${Date.now()}`)

// electronのapp.getPathをモック
vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => {
      if (name === "userData") return TEST_USER_DATA_DIR
      return "/tmp/test"
    },
  },
}))

// dataManagerをモック（テスト用データディレクトリ）
vi.mock("../../electron-src/lib/dataManager", () => ({
  getDataDirectory: () => TEST_DATA_DIR,
}))

import {
  ensureClientId,
  ensureSyncDirectory,
  getLocalDbDirectory,
  getLocalDbPath,
  getNasDbPath,
  getNasSyncPath,
  loadSyncConfig,
  saveSyncConfig,
} from "../../electron-src/lib/sync/syncConfig"
import { DEFAULT_SYNC_CONFIG } from "../../electron-src/lib/sync/types"

describe("syncConfig", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DATA_DIR)) {
      fs.mkdirSync(TEST_DATA_DIR, { recursive: true })
    }
    if (!fs.existsSync(TEST_USER_DATA_DIR)) {
      fs.mkdirSync(TEST_USER_DATA_DIR, { recursive: true })
    }
  })

  afterEach(() => {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true })
    }
    if (fs.existsSync(TEST_USER_DATA_DIR)) {
      fs.rmSync(TEST_USER_DATA_DIR, { recursive: true, force: true })
    }
  })

  describe("パス関数", () => {
    it("getNasSyncPathがdataDir/syncを返す", () => {
      expect(getNasSyncPath()).toBe(path.join(TEST_DATA_DIR, "sync"))
    })

    it("getNasDbPathがdataDir/database.dbを返す", () => {
      expect(getNasDbPath()).toBe(path.join(TEST_DATA_DIR, "database.db"))
    })

    it("getLocalDbDirectoryがuserData/score-at-onceを返す", () => {
      expect(getLocalDbDirectory()).toBe(
        path.join(TEST_USER_DATA_DIR, "score-at-once")
      )
    })

    it("getLocalDbPathがuserData/score-at-once/database.dbを返す", () => {
      expect(getLocalDbPath()).toBe(
        path.join(TEST_USER_DATA_DIR, "score-at-once", "database.db")
      )
    })
  })

  describe("設定の読み書き", () => {
    it("設定ファイル未存在時はデフォルトを返す", () => {
      const config = loadSyncConfig()
      expect(config).toEqual(DEFAULT_SYNC_CONFIG)
    })

    it("設定を保存して読み込める", () => {
      const config = {
        ...DEFAULT_SYNC_CONFIG,
        enabled: true,
        clientId: "test-client-123",
      }
      saveSyncConfig(config)

      const loaded = loadSyncConfig()
      expect(loaded.enabled).toBe(true)
      expect(loaded.clientId).toBe("test-client-123")
    })

    it("不正なJSONの場合はデフォルトを返す", () => {
      const configPath = path.join(TEST_USER_DATA_DIR, "sync-config.json")
      fs.writeFileSync(configPath, "invalid json", "utf-8")

      const config = loadSyncConfig()
      expect(config).toEqual(DEFAULT_SYNC_CONFIG)
    })
  })

  describe("ensureClientId", () => {
    it("clientIdが空の場合はUUIDを生成して保存する", () => {
      const config = { ...DEFAULT_SYNC_CONFIG }
      const result = ensureClientId(config)

      expect(result.clientId).toBeTruthy()
      expect(result.clientId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )

      // 保存されているか確認
      const loaded = loadSyncConfig()
      expect(loaded.clientId).toBe(result.clientId)
    })

    it("clientIdが既にある場合は変更しない", () => {
      const config = { ...DEFAULT_SYNC_CONFIG, clientId: "existing-id" }
      const result = ensureClientId(config)
      expect(result.clientId).toBe("existing-id")
    })
  })

  describe("ensureSyncDirectory", () => {
    it("syncディレクトリを作成する", () => {
      const syncPath = getNasSyncPath()
      expect(fs.existsSync(syncPath)).toBe(false)

      ensureSyncDirectory()
      expect(fs.existsSync(syncPath)).toBe(true)
    })

    it("既に存在する場合はエラーにならない", () => {
      ensureSyncDirectory()
      expect(() => ensureSyncDirectory()).not.toThrow()
    })
  })
})
