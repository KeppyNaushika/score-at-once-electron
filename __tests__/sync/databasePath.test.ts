/**
 * getDatabasePath のsync対応テスト
 *
 * かつて `getDatabasePath()` は `require("../sync/syncConfig")` で syncConfig を読み、
 * その失敗ごと try/catch で飲んでいた。vite-node に `require` は無いので、テストからは
 * 常に `getDataDirectory()/database.db` の枝しか踏めず、
 * 「sync有効時にローカルDBを返す」分岐は一度も検証されていなかった
 * （このファイルも、syncConfig の関数を並べて分岐を**真似る**ことしかできていなかった）。
 *
 * 静的 import へ寄せた今は本物の `getDatabasePath()` を両方の枝で呼べるので、そうする。
 * DBは作らない（パス計算のみ）。
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

import { getDatabasePath } from "../../electron-src/lib/prisma/databaseInitializer"
import {
  getLocalDbPath,
  getNasDbPath,
  saveSyncConfig,
} from "../../electron-src/lib/sync/syncConfig"
import { DEFAULT_SYNC_CONFIG } from "../../electron-src/lib/sync/types"

/** sync設定ファイル。`syncConfig` が userData 直下に置くのと同じ場所 */
const CONFIG_PATH = path.join(TEST_LOCAL_DIR, "sync-config.json")

const NAS_DB = path.join(TEST_DATA_DIR, "database.db")
const LOCAL_DB = path.join(TEST_LOCAL_DIR, "score-at-once", "database.db")

describe("getDatabasePath のsync分岐", () => {
  beforeEach(() => {
    // このファイルの electron モックが `__tests__/setup.ts` の全体モックを上書きできて
    // いないと、sync設定の書き込み先が本来の data/ 配下になる。
    // `getLocalDbPath()` も `getConfigPath()` も同じ `app.getPath("userData")` を見るので、
    // 前者が /tmp を指していることを保存前に確かめておく。
    if (getLocalDbPath() !== LOCAL_DB) {
      throw new Error(
        `electronモックが効いていません（書き込み先: ${getLocalDbPath()}）`
      )
    }
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true })
    fs.mkdirSync(TEST_LOCAL_DIR, { recursive: true })
    fs.rmSync(CONFIG_PATH, { force: true })
  })

  afterEach(() => {
    for (const dir of [TEST_DATA_DIR, TEST_LOCAL_DIR]) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  it("2つの枝は別の場所を指す（取り違えても気づけるようにする）", () => {
    expect(getNasDbPath()).toBe(NAS_DB)
    expect(getLocalDbPath()).toBe(LOCAL_DB)
    expect(NAS_DB).not.toBe(LOCAL_DB)
  })

  it("sync有効時はローカルDBパスを返すべき", () => {
    saveSyncConfig({
      ...DEFAULT_SYNC_CONFIG,
      enabled: true,
      clientId: "test",
    })

    expect(getDatabasePath()).toBe(LOCAL_DB)
  })

  it("sync無効時はデータディレクトリのDBパスを返すべき", () => {
    saveSyncConfig({ ...DEFAULT_SYNC_CONFIG, enabled: false })

    expect(getDatabasePath()).toBe(NAS_DB)
  })

  it("設定ファイルが無い初回起動でもデータディレクトリのDBパスを返すべき", () => {
    expect(fs.existsSync(CONFIG_PATH)).toBe(false)

    expect(getDatabasePath()).toBe(NAS_DB)
  })

  it("同じ起動中でも設定の切り替えに追随すべき", () => {
    saveSyncConfig({
      ...DEFAULT_SYNC_CONFIG,
      enabled: true,
      clientId: "test",
    })
    expect(getDatabasePath()).toBe(LOCAL_DB)

    saveSyncConfig({ ...DEFAULT_SYNC_CONFIG, enabled: false })
    expect(getDatabasePath()).toBe(NAS_DB)
  })
})
