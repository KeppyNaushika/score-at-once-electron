/**
 * syncService のユニットテスト
 *
 * ローカルDBの用意・書き戻し・削除と `updateSyncConfig` の順序のテスト。
 * sqlite-nas-syncのsetupSyncはモック化し、DB操作のロジックを検証する。
 *
 * **DB は本物の SQLite ファイルを使う。** 写しは `backup()` で行うので、中身が
 * SQLite でなければ意味のある検証にならない（WAL の中にしか無い書き込みが
 * 落ちないことを確かめるのが主眼）。
 */

import Database from "better-sqlite3"
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
//
// 同期はかぶった行が隠れた・戻ったことを監査ログへ書くので、syncService から auditLog →
// prisma/client と芋づるで読み込まれる。client.ts は読み込みの時点で
// createSharedPrismaClient() を呼ぶため、このモックにも口が要る。
// ここで見るのはパス解決と設定の読み書きで、監査ログは書かない。
vi.mock("../../electron-src/lib/prisma/databaseInitializer", () => ({
  getDatabasePath: () =>
    path.join(TEST_LOCAL_DIR, "score-at-once", "database.db"),
  createSharedPrismaClient: () => ({
    auditLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }),
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

/** 検証用の表を1つだけ持つ SQLite ファイルを作り、印を1行入れる */
function createDatabaseWithMarker(dbPath: string, marker: string): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.pragma("journal_mode = WAL")
  db.exec("CREATE TABLE IF NOT EXISTS Marker (id TEXT PRIMARY KEY NOT NULL)")
  db.prepare("INSERT OR REPLACE INTO Marker (id) VALUES (?)").run(marker)
  db.close()
}

/** DB に入っている印をすべて読む */
function readMarkers(dbPath: string): string[] {
  const db = new Database(dbPath, { readonly: true })
  try {
    return db
      .prepare("SELECT id FROM Marker ORDER BY id")
      .all()
      .map((row) => (row as { id: string }).id)
  } finally {
    db.close()
  }
}

describe("syncService", () => {
  beforeEach(() => {
    // テスト用ディレクトリ作成
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true })
    fs.mkdirSync(TEST_LOCAL_DIR, { recursive: true })

    // NAS上にダミーDBを作成
    createDatabaseWithMarker(getNasDbPath(), "NAS-DB-CONTENT")

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

      expect(readMarkers(localDbPath)).toEqual(["NAS-DB-CONTENT"])
    })

    it("ローカルDBが既に存在する場合は上書きしない", async () => {
      // ローカルDBを先に作成
      const localDbPath = getLocalDbPath()
      createDatabaseWithMarker(localDbPath, "LOCAL-EXISTING-CONTENT")

      const config = {
        ...DEFAULT_SYNC_CONFIG,
        enabled: true,
        clientId: "test-client",
      }
      saveSyncConfig(config)

      await startSync(config)

      expect(readMarkers(localDbPath)).toEqual(["LOCAL-EXISTING-CONTENT"])
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

  describe("ローカルDBの書き戻し（updateSyncConfig経由）", () => {
    /** sync有効状態にして、ローカルDBを用意する */
    async function enableSync(): Promise<void> {
      const config = {
        ...DEFAULT_SYNC_CONFIG,
        enabled: true,
        clientId: "test-client",
      }
      saveSyncConfig(config)
      await startSync(config)
    }

    it("sync無効化時にローカルDBがNASに書き戻される", async () => {
      await enableSync()

      // ローカルDBの内容を変更（採点作業をシミュレート）
      const localDbPath = getLocalDbPath()
      createDatabaseWithMarker(localDbPath, "LOCAL-MODIFIED-CONTENT")

      // sync無効化
      await updateSyncConfig({ enabled: false })

      // NAS DBにローカルの内容が書き戻されている
      expect(readMarkers(getNasDbPath())).toContain("LOCAL-MODIFIED-CONTENT")
    })

    it("チェックポイントしていない-walの中だけにある書き込みも書き戻される", async () => {
      await enableSync()

      // 採点中のアプリと同じく、接続を開いたまま書き込む。WAL の内容は本体ファイルへ
      // 移っていないので、本体だけを写すとこの行は落ちる
      const localDbPath = getLocalDbPath()
      const openConnection = new Database(localDbPath)
      openConnection.pragma("journal_mode = WAL")
      openConnection.exec(
        "CREATE TABLE IF NOT EXISTS Marker (id TEXT PRIMARY KEY NOT NULL)"
      )
      openConnection
        .prepare("INSERT OR REPLACE INTO Marker (id) VALUES (?)")
        .run("WAL-ONLY-WRITE")

      // 本体ファイルにはまだ入っていないことを確かめる（前提が崩れていたら検証にならない）
      expect(fs.existsSync(`${localDbPath}-wal`)).toBe(true)

      try {
        await updateSyncConfig({ enabled: false })
      } finally {
        openConnection.close()
      }

      expect(readMarkers(getNasDbPath())).toContain("WAL-ONLY-WRITE")
    })

    it("書き戻しに失敗したら設定を変えず、同期は入ったまま", async () => {
      await enableSync()

      // SQLite として開けないファイルにして、書き戻しを失敗させる
      const localDbPath = getLocalDbPath()
      fs.rmSync(`${localDbPath}-wal`, { force: true })
      fs.rmSync(`${localDbPath}-shm`, { force: true })
      fs.writeFileSync(localDbPath, "NOT-A-SQLITE-FILE", "utf-8")

      await expect(updateSyncConfig({ enabled: false })).rejects.toThrow()

      // 設定は書き換わっていない＝もう一度やり直せる
      expect(loadSyncConfig().enabled).toBe(true)
      // 控えも消えていない＝何も失われていない
      expect(fs.existsSync(localDbPath)).toBe(true)
    })

    it("控えの削除に失敗しても設定は保存され、同期は切れる", async () => {
      await enableSync()

      // 親ディレクトリを書き込み不可にして、控えのディレクトリを消せなくする
      // （設定ファイルは既にあるので、書き換えはこの状態でもできる）
      fs.chmodSync(TEST_LOCAL_DIR, 0o500)
      try {
        await expect(
          updateSyncConfig({ enabled: false })
        ).resolves.toBeUndefined()
      } finally {
        fs.chmodSync(TEST_LOCAL_DIR, 0o700)
      }

      // 消し残りはあるが、設定は保存されていて同期は切れている
      expect(fs.existsSync(getLocalDbDirectory())).toBe(true)
      expect(loadSyncConfig().enabled).toBe(false)
    })

    it("最後の同期は停止より前に実行する", async () => {
      await enableSync()

      mockSyncNow.mockClear()
      mockStop.mockClear()

      await updateSyncConfig({ enabled: false })

      expect(mockSyncNow).toHaveBeenCalledTimes(1)
      expect(mockStop).toHaveBeenCalledTimes(1)
      expect(mockSyncNow.mock.invocationCallOrder[0]).toBeLessThan(
        mockStop.mock.invocationCallOrder[0]
      )
    })

    it("最後の同期が失敗しても同期は切れる", async () => {
      await enableSync()

      mockSyncNow.mockRejectedValueOnce(new Error("NAS unreachable"))

      await expect(
        updateSyncConfig({ enabled: false })
      ).resolves.toBeUndefined()

      expect(loadSyncConfig().enabled).toBe(false)
      expect(fs.existsSync(getLocalDbDirectory())).toBe(false)
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

    // `loadSyncConfig()` は設定ファイルが無いときも壊れているときも、例外を握りつぶして
    // 既定値（enabled: false）を返す。起動時に「無効なら控えを消す」と、設定ファイルが
    // 失われただけで、書き戻していないローカルDB（利用者の唯一のデータ）が消える。
    // 同期を切れなくなった利用者が設定ファイルを手で書き換える回避策も同じ経路を通る。
    it.each([
      ["設定ファイルが無い", null],
      ["設定ファイルが壊れている", "{ this is not json"],
    ])("%s状態でも、ローカルDBの控えを消さない", async (_name, rawConfig) => {
      // 書き戻していないローカルDBがある状態を作る
      const localDbPath = getLocalDbPath()
      createDatabaseWithMarker(localDbPath, "ONLY-COPY-OF-THE-DATA")

      const configPath = path.join(TEST_LOCAL_DIR, "sync-config.json")
      if (rawConfig === null) {
        fs.rmSync(configPath, { force: true })
      } else {
        fs.writeFileSync(configPath, rawConfig, "utf-8")
      }

      await initializeSync()

      expect(getSyncStatus().state).toBe("disabled")
      expect(fs.existsSync(localDbPath)).toBe(true)
      expect(readMarkers(localDbPath)).toEqual(["ONLY-COPY-OF-THE-DATA"])
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
