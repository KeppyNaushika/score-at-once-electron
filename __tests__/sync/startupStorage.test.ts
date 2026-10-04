/**
 * 起動時に根を決める（`prepareStorageAtStartup`）
 *
 * - 旧版（userData に同期の控えがある版）からの引き継ぎ
 * - data を別のPCへ写したときの clientId の振り直し
 * - 共有プロファイルで起動できないときの扱い
 *
 * DB は本物の SQLite ファイルを使う。引き継ぎは `backup()` で写すので、`-wal` の中にしか
 * 無い書き込みが落ちないことまで見る。
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { setupSync } from "sqlite-nas-sync"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getSharedReplicaDatabasePath,
  writeSharedFolderMarker,
} from "../../electron-src/lib/sync/sharedFolder"
import {
  prepareStorageAtStartup,
  type StartupStorageEnvironment,
  StorageStartupError,
} from "../../electron-src/lib/sync/startupStorage"
import {
  loadSyncConfig,
  saveSyncConfig,
} from "../../electron-src/lib/sync/syncConfig"
import { DEFAULT_SYNC_CONFIG } from "../../electron-src/lib/sync/types"

const TEST_ROOT = path.join(os.tmpdir(), "score-at-once-startup-storage-test")
const DATA_DIR = path.join(TEST_ROOT, "data")
const USER_DATA = path.join(TEST_ROOT, "userData")
const SHARED_FOLDER = path.join(TEST_ROOT, "shared-folder")
const SHARED_ID = "3e4f5a6b-7c8d-4e9f-a0b1-c2d3e4f5a6b7"
const OTHER_SHARED_ID = "4f5a6b7c-8d9e-4fa0-b1c2-d3e4f5a6b7c8"

const LOCAL_DB = path.join(DATA_DIR, "database.db")
const LEGACY_CONFIG = path.join(USER_DATA, "sync-config.json")
const LEGACY_REPLICA_DIR = path.join(USER_DATA, "score-at-once")
const LEGACY_REPLICA = path.join(LEGACY_REPLICA_DIR, "database.db")

const OWNER = { installationId: "inst-this-pc", hostname: "this-pc" }

/** 印を持つ SQLite を作る。`keepWal` なら最後の書き込みを `-wal` に残したまま閉じない */
function createMarkerDatabase(
  dbPath: string,
  markers: string[],
  options: { keepWal?: boolean } = {}
): Database.Database | null {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.pragma("journal_mode = WAL")
  db.exec("CREATE TABLE IF NOT EXISTS Marker (id TEXT PRIMARY KEY NOT NULL)")
  if (options.keepWal) db.pragma("wal_autocheckpoint = 0")
  for (const marker of markers) {
    db.prepare("INSERT OR REPLACE INTO Marker (id) VALUES (?)").run(marker)
  }
  if (options.keepWal) return db
  db.close()
  return null
}

function readMarkers(dbPath: string): string[] {
  const db = new Database(dbPath, { readonly: true })
  try {
    return db
      .prepare<[], { id: string }>("SELECT id FROM Marker ORDER BY id")
      .all()
      .map((row) => row.id)
  } finally {
    db.close()
  }
}

function environment(
  overrides: Partial<StartupStorageEnvironment> = {}
): StartupStorageEnvironment {
  return {
    localDataDirectory: DATA_DIR,
    legacyUserDataDirectory: USER_DATA,
    currentOwner: OWNER,
    notify: vi.fn(async () => undefined),
    confirmLocalFallback: vi.fn(async () => true),
    ...overrides,
  }
}

function saveSharedConfig(sharedFolderId: string = SHARED_ID): void {
  saveSyncConfig(
    {
      ...DEFAULT_SYNC_CONFIG,
      mode: "shared",
      activeSharedFolderId: sharedFolderId,
      sharedProfiles: [{ sharedFolderId, sharedFolderPath: SHARED_FOLDER }],
      clientId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
      clientIdOwner: OWNER,
    },
    DATA_DIR
  )
}

beforeEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(USER_DATA, { recursive: true })
})
afterEach(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe("新規インストール", () => {
  it("ローカルモードの根で起動し、このPCの clientId を data の設定へ書く", async () => {
    const roots = await prepareStorageAtStartup(environment())
    expect(roots).toEqual({
      mode: "local",
      databasePath: LOCAL_DB,
      sharedFilesDirectory: DATA_DIR,
      localDataDirectory: DATA_DIR,
      sharedFolder: null,
    })
    const saved = loadSyncConfig(DATA_DIR)
    expect(saved.mode).toBe("local")
    expect(saved.clientIdOwner).toEqual(OWNER)
    expect(saved.clientId).not.toBe("")
  })
})

describe("旧版からの引き継ぎ", () => {
  it("同期が入っていたら、控え（-wal の中の書き込みも）で data/database.db を置き換え、旧版の控えと設定を片づける", async () => {
    fs.writeFileSync(
      LEGACY_CONFIG,
      JSON.stringify({ enabled: true, clientId: "old", intervalMs: 30000 })
    )
    const legacyHandle = createMarkerDatabase(
      LEGACY_REPLICA,
      ["from-replica", "only-in-wal"],
      { keepWal: true }
    )
    // 置き換えられる側も WAL に書きかけを持っている
    const localHandle = createMarkerDatabase(LOCAL_DB, ["stale-local"], {
      keepWal: true,
    })
    expect(fs.statSync(`${LEGACY_REPLICA}-wal`).size).toBeGreaterThan(0)
    legacyHandle?.close()
    localHandle?.close()
    // close はチェックポイントするので、もう一度 WAL にだけ書く
    const reopened = new Database(LEGACY_REPLICA)
    reopened.pragma("wal_autocheckpoint = 0")
    reopened.prepare("INSERT INTO Marker (id) VALUES ('after-reopen')").run()

    // 新しい版の設定では共有モードになっていても、引き継ぎはローカルモードへ戻す
    saveSharedConfig()
    const env = environment()
    const roots = await prepareStorageAtStartup(env)
    reopened.close()

    expect(roots.mode).toBe("local")
    expect(readMarkers(LOCAL_DB)).toEqual([
      "after-reopen",
      "from-replica",
      "only-in-wal",
    ])
    expect(fs.existsSync(LEGACY_CONFIG)).toBe(false)
    expect(fs.existsSync(LEGACY_REPLICA_DIR)).toBe(false)
    expect(loadSyncConfig(DATA_DIR).mode).toBe("local")
    expect(env.notify).toHaveBeenCalledTimes(1)
  })

  it("旧版の設定が enabled: false なら、控えが残っていても何も触らない（data/database.db のほうが新しい）", async () => {
    fs.writeFileSync(LEGACY_CONFIG, JSON.stringify({ enabled: false }))
    createMarkerDatabase(LEGACY_REPLICA, ["leftover"])
    createMarkerDatabase(LOCAL_DB, ["current"])

    await prepareStorageAtStartup(environment())

    expect(readMarkers(LOCAL_DB)).toEqual(["current"])
    expect(fs.existsSync(LEGACY_CONFIG)).toBe(true)
    expect(fs.existsSync(LEGACY_REPLICA)).toBe(true)
  })

  it("旧版の設定が壊れていても何も触らない（旧版は data/database.db を開いていた）", async () => {
    fs.writeFileSync(LEGACY_CONFIG, "{ broken")
    createMarkerDatabase(LEGACY_REPLICA, ["leftover"])
    createMarkerDatabase(LOCAL_DB, ["current"])

    await prepareStorageAtStartup(environment())

    expect(readMarkers(LOCAL_DB)).toEqual(["current"])
    expect(fs.existsSync(LEGACY_REPLICA)).toBe(true)
  })

  it("写せなければ起動を止め、控えも旧版の設定も消さない", async () => {
    fs.writeFileSync(LEGACY_CONFIG, JSON.stringify({ enabled: true }))
    createMarkerDatabase(LEGACY_REPLICA, ["precious"])
    // 写し先にディレクトリを置いて、写しを失敗させる
    fs.mkdirSync(LOCAL_DB, { recursive: true })

    await expect(prepareStorageAtStartup(environment())).rejects.toBeInstanceOf(
      StorageStartupError
    )
    expect(fs.existsSync(LEGACY_CONFIG)).toBe(true)
    expect(readMarkers(LEGACY_REPLICA)).toEqual(["precious"])
  })

  it("data を差し替えて起動したとき（userData を見ない）は引き継がない", async () => {
    fs.writeFileSync(LEGACY_CONFIG, JSON.stringify({ enabled: true }))
    createMarkerDatabase(LEGACY_REPLICA, ["not-for-this-data"])

    await prepareStorageAtStartup(
      environment({ legacyUserDataDirectory: null })
    )

    expect(fs.existsSync(LOCAL_DB)).toBe(false)
    expect(fs.existsSync(LEGACY_REPLICA)).toBe(true)
  })
})

describe("clientId の重なり", () => {
  it("別のPCで振った clientId は、起動時に振り直して保存する", async () => {
    saveSyncConfig(
      {
        ...DEFAULT_SYNC_CONFIG,
        clientId: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
        clientIdOwner: {
          installationId: "inst-other-pc",
          hostname: "other-pc",
        },
      },
      DATA_DIR
    )
    await prepareStorageAtStartup(environment())
    const saved = loadSyncConfig(DATA_DIR)
    expect(saved.clientId).not.toBe("2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e")
    expect(saved.clientIdOwner).toEqual(OWNER)
  })
})

describe("共有プロファイルで起動する", () => {
  const replicaPath = getSharedReplicaDatabasePath(DATA_DIR, SHARED_ID)

  it("手元の控えがあり、識別ファイルが合えば共有モードの根", async () => {
    saveSharedConfig()
    createMarkerDatabase(replicaPath, [])
    fs.mkdirSync(SHARED_FOLDER, { recursive: true })
    writeSharedFolderMarker(SHARED_FOLDER, SHARED_ID)

    const roots = await prepareStorageAtStartup(environment())
    expect(roots).toEqual({
      mode: "shared",
      databasePath: replicaPath,
      sharedFilesDirectory: path.join(SHARED_FOLDER, "files"),
      localDataDirectory: DATA_DIR,
      sharedFolder: {
        sharedFolderId: SHARED_ID,
        sharedFolderPath: SHARED_FOLDER,
      },
    })
  })

  it("共有フォルダに届かないだけなら、手元の控えで共有モードのまま起動する", async () => {
    saveSharedConfig()
    createMarkerDatabase(replicaPath, [])
    const env = environment()
    const roots = await prepareStorageAtStartup(env)
    expect(roots.mode).toBe("shared")
    expect(env.confirmLocalFallback).not.toHaveBeenCalled()
  })

  it("届いているのに別の共有フォルダなら、ローカルモードで起動するかを尋ねる", async () => {
    saveSharedConfig()
    createMarkerDatabase(replicaPath, [])
    fs.mkdirSync(SHARED_FOLDER, { recursive: true })
    writeSharedFolderMarker(SHARED_FOLDER, OTHER_SHARED_ID)
    const env = environment()

    const roots = await prepareStorageAtStartup(env)

    expect(env.confirmLocalFallback).toHaveBeenCalledTimes(1)
    expect(roots.mode).toBe("local")
    expect(loadSyncConfig(DATA_DIR).mode).toBe("local")
  })

  it("手元の控えが無く、利用者が終了を選んだら起動しない（設定も変えない）", async () => {
    saveSharedConfig()
    const env = environment({ confirmLocalFallback: vi.fn(async () => false) })

    await expect(prepareStorageAtStartup(env)).rejects.toBeInstanceOf(
      StorageStartupError
    )
    expect(loadSyncConfig(DATA_DIR).mode).toBe("shared")
  })
})

/** sqlite_master の中身（SQLite 自身のものを除く） */
function schemaObjects(dbPath: string): string[] {
  const db = new Database(dbPath, { readonly: true })
  try {
    return db
      .prepare<[], { type: string; name: string }>(
        `SELECT type, name FROM sqlite_master
          WHERE name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY type, name`
      )
      .all()
      .map((row) => `${row.type} ${row.name}`)
  } finally {
    db.close()
  }
}

/** アプリの表を1つだけ持つ DB（同期できる形: id と updatedAt） */
function createNoteDatabase(dbPath: string): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.exec(
    `CREATE TABLE Note (id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL, updatedAt TEXT NOT NULL)`
  )
  db.prepare(
    `INSERT INTO Note VALUES ('n1', 'kept', '2026-01-01T00:00:00.000Z')`
  ).run()
  db.close()
}

describe("ローカルモードの DB に残った同期の仕組み", () => {
  it("旧版で同期を切って書き戻した DB から、起動時に取り除く。アプリの表の行は変わらない", async () => {
    createNoteDatabase(LOCAL_DB)
    const before = schemaObjects(LOCAL_DB)
    const instance = setupSync({
      dbPath: LOCAL_DB,
      nasPath: path.join(TEST_ROOT, "old-sync"),
      clientId: "old-client",
      intervalMs: 600_000,
    })
    await instance.syncNow()
    await instance.close()
    expect(schemaObjects(LOCAL_DB)).not.toEqual(before)

    const roots = await prepareStorageAtStartup(environment())

    expect(roots.mode).toBe("local")
    expect(schemaObjects(LOCAL_DB)).toEqual(before)
    const db = new Database(LOCAL_DB, { readonly: true })
    expect(db.prepare(`SELECT id, body FROM Note`).all()).toEqual([
      { id: "n1", body: "kept" },
    ])
    db.close()
  })

  it("何も残っていない DB には何もしない", async () => {
    createNoteDatabase(LOCAL_DB)
    const before = schemaObjects(LOCAL_DB)
    await prepareStorageAtStartup(environment())
    expect(schemaObjects(LOCAL_DB)).toEqual(before)
  })

  it("DB がまだ無ければ作らない（新規インストールは初期化が作る）", async () => {
    await prepareStorageAtStartup(environment())
    expect(fs.existsSync(LOCAL_DB)).toBe(false)
  })

  it("取り除けなくても起動は続ける", async () => {
    // DB の場所にディレクトリを置いて、開けないようにする
    fs.mkdirSync(LOCAL_DB, { recursive: true })
    const roots = await prepareStorageAtStartup(
      environment({ legacyUserDataDirectory: null })
    )
    expect(roots.mode).toBe("local")
  })

  it("共有モードで起動するときは、手元の控えに触らない", async () => {
    const replicaPath = getSharedReplicaDatabasePath(DATA_DIR, SHARED_ID)
    createNoteDatabase(replicaPath)
    const instance = setupSync({
      dbPath: replicaPath,
      nasPath: path.join(SHARED_FOLDER, "sync"),
      clientId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
      intervalMs: 600_000,
    })
    await instance.close()
    const before = schemaObjects(replicaPath)
    saveSharedConfig()
    fs.mkdirSync(SHARED_FOLDER, { recursive: true })
    writeSharedFolderMarker(SHARED_FOLDER, SHARED_ID)

    const roots = await prepareStorageAtStartup(environment())

    expect(roots.mode).toBe("shared")
    expect(schemaObjects(replicaPath)).toEqual(before)
  })
})
