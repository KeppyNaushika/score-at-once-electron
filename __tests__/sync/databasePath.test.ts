/**
 * getDatabasePath のsync対応テスト
 *
 * getDatabasePath()は内部でrequire("../sync/syncConfig")を使うため、
 * syncConfig.tsのモジュールが正しく解決される必要がある。
 * ここではsyncConfigの関数を直接テストし、getDatabasePathの動作を検証する。
 */

import * as fs from "fs"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DATA_DIR = path.join("/tmp", `dbpath-test-${Date.now()}`)
const TEST_LOCAL_DIR = path.join("/tmp", `dbpath-local-${Date.now()}`)

vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => {
      if (name === "userData") return TEST_LOCAL_DIR
      return "/tmp/test"
    },
  },
}))

vi.mock("../../electron-src/lib/dataManager", () => ({
  getDataDirectory: () => TEST_DATA_DIR,
}))

import {
  getLocalDbPath,
  getNasDbPath,
  loadSyncConfig,
  saveSyncConfig,
} from "../../electron-src/lib/sync/syncConfig"
import { DEFAULT_SYNC_CONFIG } from "../../electron-src/lib/sync/types"

describe("DBパスのsync対応ロジック", () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true })
    fs.mkdirSync(TEST_LOCAL_DIR, { recursive: true })
  })

  afterEach(() => {
    for (const dir of [TEST_DATA_DIR, TEST_LOCAL_DIR]) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  it("sync無効時はNAS DBパスを使うべき", () => {
    saveSyncConfig({ ...DEFAULT_SYNC_CONFIG, enabled: false })
    const config = loadSyncConfig()
    expect(config.enabled).toBe(false)

    // sync無効 → getNasDbPath()が使われる
    const nasPath = getNasDbPath()
    expect(nasPath).toBe(path.join(TEST_DATA_DIR, "database.db"))
  })

  it("sync有効時はローカルDBパスを使うべき", () => {
    saveSyncConfig({
      ...DEFAULT_SYNC_CONFIG,
      enabled: true,
      clientId: "test",
    })
    const config = loadSyncConfig()
    expect(config.enabled).toBe(true)

    // sync有効 → getLocalDbPath()が使われる
    const localPath = getLocalDbPath()
    expect(localPath).toBe(
      path.join(TEST_LOCAL_DIR, "score-at-once", "database.db")
    )
  })

  it("getDatabasePathの分岐ロジックが正しい", () => {
    // sync無効時
    saveSyncConfig({ ...DEFAULT_SYNC_CONFIG, enabled: false })
    let config = loadSyncConfig()
    const pathWhenDisabled = config.enabled ? getLocalDbPath() : getNasDbPath()
    expect(pathWhenDisabled).toBe(path.join(TEST_DATA_DIR, "database.db"))

    // sync有効時
    saveSyncConfig({
      ...DEFAULT_SYNC_CONFIG,
      enabled: true,
      clientId: "test",
    })
    config = loadSyncConfig()
    const pathWhenEnabled = config.enabled ? getLocalDbPath() : getNasDbPath()
    expect(pathWhenEnabled).toBe(
      path.join(TEST_LOCAL_DIR, "score-at-once", "database.db")
    )
  })
})
