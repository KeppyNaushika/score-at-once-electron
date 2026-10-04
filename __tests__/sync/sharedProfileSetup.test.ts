/**
 * 共有プロファイルの用意と、モードをまたぐ移行（本物のスキーマ・本物の sqlite-nas-sync）
 *
 * - ローカル → 共有: 空の共有フォルダへ DB と画像を丸写しし、同期の写しまで上げる。
 *   空でなければ断る。写しの途中で失敗したら、作ったものだけを片づける
 * - 空のプロファイル: 見本だけの DB で共有を始める
 * - 合流: **空の DB にマイグレーションを当て、全クライアントの写しから読み込むだけで
 *   追いつけるか**（issue #1322 の実測）。このPCのローカルのデータは混ぜない
 * - 共有 → ローカル: ローカルが空のときだけ丸写しし、同期の仕組みを取り除く
 * - 旧版の控えの引き継ぎも、同じく同期の仕組みを取り除く
 *
 * PC は data のディレクトリで分ける（PC-A・PC-B・PC-C）。同期はライブラリをモックしない。
 */
import Database from "better-sqlite3"
import { execFileSync } from "child_process"
import * as crypto from "crypto"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClientForPath } from "../../electron-src/lib/prisma/databaseInitializer"
import { seedSampleData } from "../../electron-src/lib/prisma/sampleSeed"
import { createBaseline } from "../../electron-src/lib/prisma/schema/baselineMigrations"
import { deployPendingMigrations } from "../../electron-src/lib/prisma/schema/migrationDeployer"
import { bootstrapSchema } from "../../electron-src/lib/prisma/schema/schemaBootstrap"
import { openAppDatabase } from "../../electron-src/lib/prisma/sqliteConnection"
import { assertDatabaseIntact } from "../../electron-src/lib/sync/databaseCopy"
import { migrateLegacyUserDataReplica } from "../../electron-src/lib/sync/legacyUserDataMigration"
import { findLocalUserData } from "../../electron-src/lib/sync/localDataEmptiness"
import {
  getSharedFolderSyncDirectory,
  getSharedReplicaDatabasePath,
  inspectSharedFolder,
  readSharedFolderId,
  writeSharedFolderMarker,
} from "../../electron-src/lib/sync/sharedFolder"
import {
  createEmptySharedProfile,
  joinSharedFolder,
  migrateLocalDataToSharedFolder,
  migrateSharedProfileToLocal,
} from "../../electron-src/lib/sync/sharedProfileSetup"
import { createAppSyncInstance } from "../../electron-src/lib/sync/syncInstanceFactory"
import type { SharedProfile } from "../../electron-src/lib/sync/types"

const TEST_ROOT = path.join(os.tmpdir(), "score-at-once-shared-profile-setup")
const DATA_A = path.join(TEST_ROOT, "pc-a", "data")
const DATA_B = path.join(TEST_ROOT, "pc-b", "data")
const DATA_C = path.join(TEST_ROOT, "pc-c", "data")
const SHARED = path.join(TEST_ROOT, "shared")
const SHARED_EMPTY = path.join(TEST_ROOT, "shared-empty")
const SHARED_NO_COPIES = path.join(TEST_ROOT, "shared-no-copies")
const REAL_MIGRATIONS = path.resolve(__dirname, "../../prisma/migrations")

const CLIENT_A = crypto.randomUUID()
const CLIENT_B = crypto.randomUUID()

const EXAM_ID = crypto.randomUUID()
const IMAGE_RELATIVE = path.join(
  "exams",
  EXAM_ID,
  "master-answers",
  "page-1.png"
)

const localDatabasePath = (dataDirectory: string): string =>
  path.join(dataDirectory, "database.db")

/** 新規インストールと同じ経路で DB を作り、見本を入れる */
async function createSeededDatabase(databasePath: string): Promise<void> {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  bootstrapSchema(databasePath)
  const prisma = createPrismaClientForPath(databasePath)
  try {
    await createBaseline(prisma)
    deployPendingMigrations({
      migrationsDir: REAL_MIGRATIONS,
      dbPath: databasePath,
    })
    await seedSampleData(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

function insertExam(databasePath: string, examId: string, examName: string) {
  const db = openAppDatabase(databasePath)
  try {
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO "Exam" (id, "examName", "markerCorrectionEnabled", "createdAt", "updatedAt")
       VALUES (?, ?, 0, ?, ?)`
    ).run(examId, examName, now, now)
  } finally {
    db.close()
  }
}

/** アプリの表（内部表を除く）の中身を全部読む */
function snapshotAppTables(databasePath: string): Record<string, unknown[]> {
  const db = new Database(databasePath, { readonly: true })
  try {
    const tables = db
      .prepare<[], { name: string }>(
        `SELECT name FROM sqlite_master
          WHERE type = 'table'
            AND name NOT LIKE '\\_%' ESCAPE '\\'
            AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
          ORDER BY name`
      )
      .all()
    return Object.fromEntries(
      tables.map((table) => [
        table.name,
        db.prepare(`SELECT * FROM "${table.name}" ORDER BY id`).all(),
      ])
    )
  } finally {
    db.close()
  }
}

const countRows = (databasePath: string, table: string): number => {
  const db = new Database(databasePath, { readonly: true })
  try {
    const row = db
      .prepare<[], { count: number }>(
        `SELECT COUNT(*) AS count FROM "${table}"`
      )
      .get()
    return row === undefined ? 0 : row.count
  } finally {
    db.close()
  }
}

/** `sqlite_sequence` に行のある表の名前 */
const sequenceRows = (databasePath: string): string[] => {
  const db = new Database(databasePath, { readonly: true })
  try {
    return db
      .prepare<[], { name: string }>(`SELECT name FROM sqlite_sequence`)
      .all()
      .map((row) => row.name)
  } finally {
    db.close()
  }
}

/** アプリの常駐同期と同じ作り方で1回同期する */
async function syncOnce(
  databasePath: string,
  sharedFolderPath: string,
  clientId: string
) {
  const instance = await createAppSyncInstance({
    dbPath: databasePath,
    nasPath: getSharedFolderSyncDirectory(sharedFolderPath),
    clientId,
    intervalMs: 600_000,
    changelogRetentionDays: 7,
  })
  try {
    return await instance.syncNow()
  } finally {
    await instance.close()
  }
}

/** 同期の仕組みの無い、新規インストールの DB（見比べる基準） */
const REFERENCE_DB = path.join(TEST_ROOT, "reference", "database.db")

/**
 * DB の中のもの（表・索引・トリガー・ビュー）の一覧。SQLite 自身のもの（`sqlite_`）は除く。
 *
 * 同期の仕組みが残っていないことは、ライブラリの内部の名前を挙げずに、新規インストールの
 * DB（{@link REFERENCE_DB}）と同じ一覧になること（＝アプリの表と索引だけ）で見る。
 */
function schemaObjects(databasePath: string): string[] {
  const db = new Database(databasePath, { readonly: true })
  try {
    return db
      .prepare<[], { type: string; name: string }>(
        `SELECT type, name FROM sqlite_master
          WHERE name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
          ORDER BY type, name`
      )
      .all()
      .map((row) => `${row.type} ${row.name}`)
  } finally {
    db.close()
  }
}

/**
 * このプロセスが開いているファイルのうち、`directory` の下にあるもの（lsof で見る）。
 *
 * macOS・Linux では開いているファイルも消せるので、「消せた」だけでは Windows で
 * 消せることの証明にならない。開いている手が残っていないことを直接見る。
 */
function openFilesUnder(directory: string): string[] {
  const prefixes = [directory, fs.realpathSync(directory)]
  const output = execFileSync("lsof", ["-Fn", "-p", String(process.pid)], {
    encoding: "utf-8",
  })
  return output
    .split("\n")
    .filter((line) => line.startsWith("n"))
    .map((line) => line.slice(1))
    .filter((filePath) =>
      prefixes.some((prefix) => filePath.startsWith(prefix + path.sep))
    )
}

let profileA: SharedProfile

beforeAll(async () => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  for (const directory of [
    DATA_A,
    DATA_B,
    DATA_C,
    SHARED,
    SHARED_EMPTY,
    SHARED_NO_COPIES,
  ]) {
    fs.mkdirSync(directory, { recursive: true })
  }
  await createSeededDatabase(REFERENCE_DB)
  // PC-A: 使い込んだローカルモード（試験1つと画像1枚）
  await createSeededDatabase(localDatabasePath(DATA_A))
  insertExam(localDatabasePath(DATA_A), EXAM_ID, "期末考査")
  fs.mkdirSync(path.dirname(path.join(DATA_A, IMAGE_RELATIVE)), {
    recursive: true,
  })
  fs.writeFileSync(path.join(DATA_A, IMAGE_RELATIVE), "png-bytes")
  // PC-B: 新規インストール直後（見本だけ）。合流してもこれは混ざらない
  await createSeededDatabase(localDatabasePath(DATA_B))
  insertExam(localDatabasePath(DATA_B), crypto.randomUUID(), "PC-B だけの試験")
  // PC-C: 新規インストール直後（見本だけ）
  await createSeededDatabase(localDatabasePath(DATA_C))
}, 120_000)

afterAll(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe("ローカル → 共有の移行", () => {
  it("空の共有フォルダへ DB と画像を丸写しし、識別ファイルを置く。ローカルはそのまま", async () => {
    const before = snapshotAppTables(localDatabasePath(DATA_A))
    expect(inspectSharedFolder(SHARED)).toEqual({ kind: "empty" })

    profileA = await migrateLocalDataToSharedFolder({
      localDataDirectory: DATA_A,
      sharedFolderPath: SHARED,
      clientId: CLIENT_A,
    })

    expect(readSharedFolderId(SHARED)).toBe(profileA.sharedFolderId)
    const replicaA = getSharedReplicaDatabasePath(
      DATA_A,
      profileA.sharedFolderId
    )
    expect(snapshotAppTables(replicaA)).toEqual(before)
    expect(
      fs.readFileSync(path.join(SHARED, "files", IMAGE_RELATIVE), "utf-8")
    ).toBe("png-bytes")
    // ローカルは写しただけで変えない
    expect(snapshotAppTables(localDatabasePath(DATA_A))).toEqual(before)
    expect(fs.existsSync(path.join(DATA_A, IMAGE_RELATIVE))).toBe(true)
    // 移した時点で同期の写しまで上がっている（再起動を待たずに合流できる）
    expect(fs.readdirSync(getSharedFolderSyncDirectory(SHARED))).toEqual([
      `client-${CLIENT_A}.sqlite`,
    ])
  }, 120_000)

  it("写しを上げる途中で失敗したら、作ったものだけを片づけて断る", async () => {
    const sharedFolder = path.join(TEST_ROOT, "shared-publish-fails")
    fs.mkdirSync(sharedFolder, { recursive: true })
    fs.writeFileSync(path.join(sharedFolder, "既にあった.txt"), "keep")
    const replicasBefore = fs.existsSync(path.join(DATA_A, "shared"))
      ? fs.readdirSync(path.join(DATA_A, "shared"))
      : []

    // 写しの置き場に作れない名前の clientId で、ライブラリの写しを失敗させる
    await expect(
      migrateLocalDataToSharedFolder({
        localDataDirectory: DATA_A,
        sharedFolderPath: sharedFolder,
        clientId: path.join("no-such-directory", "x"),
      })
    ).rejects.toThrow()

    expect(fs.readdirSync(sharedFolder)).toEqual(["既にあった.txt"])
    // 片づけの前に閉じてある（Windows でも作りかけの控えを消せる）
    expect(openFilesUnder(path.join(DATA_A, "shared"))).toEqual([])
    expect(openFilesUnder(sharedFolder)).toEqual([])
    expect(fs.readdirSync(path.join(DATA_A, "shared"))).toEqual(replicasBefore)
    expect(inspectSharedFolder(sharedFolder)).toEqual({ kind: "empty" })
  }, 120_000)

  it("既に共有されているフォルダへは移さず、何も作らない", async () => {
    const replicasBefore = fs.readdirSync(path.join(DATA_B))
    await expect(
      migrateLocalDataToSharedFolder({
        localDataDirectory: DATA_B,
        sharedFolderPath: SHARED,
        clientId: CLIENT_B,
      })
    ).rejects.toThrow(/既に共有しているデータがあります/)
    expect(fs.readdirSync(path.join(DATA_B))).toEqual(replicasBefore)
  })
})

describe("合流（空の DB から共有フォルダに追いつく）", () => {
  it("写しがまだ1つも無い共有フォルダには合流せず、控えを残さない", async () => {
    // 識別ファイルだけがある共有フォルダ（用意の途中で写しが消えた、など）
    const markerOnly = path.join(TEST_ROOT, "shared-marker-only")
    fs.mkdirSync(markerOnly, { recursive: true })
    writeSharedFolderMarker(markerOnly, crypto.randomUUID())
    await expect(
      joinSharedFolder({
        localDataDirectory: DATA_B,
        sharedFolderPath: markerOnly,
        clientId: CLIENT_B,
      })
    ).rejects.toThrow(/まだ同期の写しがありません/)
    expect(fs.existsSync(path.join(DATA_B, "shared"))).toBe(false)
  })

  it("PC-A が移した直後（再起動していない）でも合流でき、1回の同期で PC-A と同じ中身になる。PC-B のローカルのデータは混ざらない", async () => {
    const joined = await joinSharedFolder({
      localDataDirectory: DATA_B,
      sharedFolderPath: SHARED,
      clientId: CLIENT_B,
    })

    expect(joined.profile.sharedFolderId).toBe(profileA.sharedFolderId)
    const replicaA = getSharedReplicaDatabasePath(
      DATA_A,
      profileA.sharedFolderId
    )
    const replicaB = getSharedReplicaDatabasePath(
      DATA_B,
      profileA.sharedFolderId
    )
    expect(snapshotAppTables(replicaB)).toEqual(snapshotAppTables(replicaA))
    // PC-B のローカルモードの試験は、共有の控えにも共有フォルダにも入らない
    expect(countRows(replicaB, "Exam")).toBe(1)
    expect(countRows(localDatabasePath(DATA_B), "Exam")).toBe(1)
    // 合流の同期は閉じてある（控えを開いた手が残っていない）ので、控えを置き換えられる
    expect(openFilesUnder(path.join(DATA_B, "shared"))).toEqual([])
    const movedAside = `${replicaB}.moved`
    fs.renameSync(replicaB, movedAside)
    fs.renameSync(movedAside, replicaB)
  }, 120_000)

  it("合流した PC-B の書き込みは、普通のクライアントとして PC-A へ届く", async () => {
    const replicaA = getSharedReplicaDatabasePath(
      DATA_A,
      profileA.sharedFolderId
    )
    const replicaB = getSharedReplicaDatabasePath(
      DATA_B,
      profileA.sharedFolderId
    )
    insertExam(replicaB, crypto.randomUUID(), "PC-B で共有に足した試験")

    await syncOnce(replicaB, SHARED, CLIENT_B)
    await syncOnce(replicaA, SHARED, CLIENT_A)

    expect(countRows(replicaA, "Exam")).toBe(2)
    expect(snapshotAppTables(replicaA)).toEqual(snapshotAppTables(replicaB))
  }, 120_000)

  it("写しがどれもこのPCより新しい版なら、合流せずにアプリの更新を促す", async () => {
    const sharedFolder = path.join(TEST_ROOT, "shared-newer")
    fs.mkdirSync(sharedFolder, { recursive: true })
    const dataNewer = path.join(TEST_ROOT, "pc-newer", "data")
    await createSeededDatabase(localDatabasePath(dataNewer))
    await migrateLocalDataToSharedFolder({
      localDataDirectory: dataNewer,
      sharedFolderPath: sharedFolder,
      clientId: crypto.randomUUID(),
    })
    // 共有フォルダの写しを、未来の版のアプリが上げたものにする
    const syncDirectory = getSharedFolderSyncDirectory(sharedFolder)
    for (const copyName of fs.readdirSync(syncDirectory)) {
      const copy = new Database(path.join(syncDirectory, copyName))
      copy
        .prepare(
          `UPDATE "_sync_meta" SET value = '29991231000000_future;sns-format=rows1' WHERE key = 'schemaVersion'`
        )
        .run()
      copy.close()
    }

    await expect(
      joinSharedFolder({
        localDataDirectory: DATA_C,
        sharedFolderPath: sharedFolder,
        clientId: crypto.randomUUID(),
      })
    ).rejects.toThrow(/新しい版のアプリ/)
  }, 120_000)
})

describe("空の共有プロファイル", () => {
  it("見本だけの控えを作り、同期の写しを上げ、識別ファイルを置く", async () => {
    const clientId = crypto.randomUUID()
    const profile = await createEmptySharedProfile({
      localDataDirectory: DATA_C,
      sharedFolderPath: SHARED_EMPTY,
      clientId,
    })
    expect(fs.readdirSync(getSharedFolderSyncDirectory(SHARED_EMPTY))).toEqual([
      `client-${clientId}.sqlite`,
    ])
    const replica = getSharedReplicaDatabasePath(DATA_C, profile.sharedFolderId)
    expect(countRows(replica, "User")).toBe(1)
    expect(countRows(replica, "Exam")).toBe(0)
    expect(readSharedFolderId(SHARED_EMPTY)).toBe(profile.sharedFolderId)
    expect(inspectSharedFolder(SHARED_EMPTY)).toEqual({
      kind: "shared",
      sharedFolderId: profile.sharedFolderId,
    })
  }, 120_000)

  it("識別ファイルが無いのに写しがあるフォルダは使わない", () => {
    fs.mkdirSync(path.join(SHARED_NO_COPIES, "sync"), { recursive: true })
    fs.writeFileSync(path.join(SHARED_NO_COPIES, "sync", "client-x.sqlite"), "")
    expect(inspectSharedFolder(SHARED_NO_COPIES).kind).toBe("unusable")
  })
})

describe("共有 → ローカルの移行", () => {
  it("ローカルに見本以外のデータがあれば断り、何も変えない", async () => {
    const before = snapshotAppTables(localDatabasePath(DATA_B))
    expect(findLocalUserData(DATA_B)).toEqual(["試験"])

    await expect(
      migrateSharedProfileToLocal({
        localDataDirectory: DATA_B,
        profile: { ...profileA, sharedFolderPath: SHARED },
      })
    ).rejects.toThrow(/ローカルモードに既にデータがあります（試験）/)
    expect(snapshotAppTables(localDatabasePath(DATA_B))).toEqual(before)
  })

  it("ローカルが見本だけなら、控えの DB と共有フォルダの画像を丸写しする", async () => {
    // PC-C を共有プロファイルに合流させてから、ローカルへ移す
    const joined = await joinSharedFolder({
      localDataDirectory: DATA_C,
      sharedFolderPath: SHARED,
      clientId: crypto.randomUUID(),
    })
    expect(findLocalUserData(DATA_C)).toEqual([])
    const replicaC = getSharedReplicaDatabasePath(
      DATA_C,
      joined.profile.sharedFolderId
    )

    await migrateSharedProfileToLocal({
      localDataDirectory: DATA_C,
      profile: joined.profile,
    })

    expect(snapshotAppTables(localDatabasePath(DATA_C))).toEqual(
      snapshotAppTables(replicaC)
    )
    expect(fs.readFileSync(path.join(DATA_C, IMAGE_RELATIVE), "utf-8")).toBe(
      "png-bytes"
    )
    // 同期の仕組みは取り除かれ（新規インストールと同じ中身の一覧）、控えの側には残っている
    expect(schemaObjects(localDatabasePath(DATA_C))).toEqual(
      schemaObjects(REFERENCE_DB)
    )
    expect(schemaObjects(replicaC)).not.toEqual(schemaObjects(REFERENCE_DB))
    expect(sequenceRows(localDatabasePath(DATA_C))).not.toContain("_changelog")
    expect(() => assertDatabaseIntact(localDatabasePath(DATA_C))).not.toThrow()
    // 移したあとのローカルは空ではない（もう一度は移せない）
    expect(findLocalUserData(DATA_C)).toEqual(["試験", "画像"])
    // 共有フォルダには何も書かない（識別ファイルはそのまま）
    expect(readSharedFolderId(SHARED)).toBe(profileA.sharedFolderId)
  }, 120_000)
})

describe("旧版の控えの引き継ぎ（userData → data/database.db）", () => {
  it("同期で使っていた控えを写し、同期の仕組みを取り除く。アプリの表は控えと一致する", async () => {
    const userData = path.join(TEST_ROOT, "legacy", "userData")
    const legacyReplica = path.join(userData, "score-at-once", "database.db")
    const dataDirectory = path.join(TEST_ROOT, "legacy", "data")
    // 旧版で同期を入れていた控え（ライブラリの仕組みが張られ、写しも上げた）
    await createSeededDatabase(legacyReplica)
    insertExam(legacyReplica, crypto.randomUUID(), "旧版で作った試験")
    const legacyShared = path.join(TEST_ROOT, "legacy", "data-sync")
    fs.mkdirSync(legacyShared, { recursive: true })
    await syncOnce(legacyReplica, legacyShared, crypto.randomUUID())
    expect(schemaObjects(legacyReplica)).not.toEqual(
      schemaObjects(REFERENCE_DB)
    )
    const expected = snapshotAppTables(legacyReplica)
    fs.writeFileSync(
      path.join(userData, "sync-config.json"),
      JSON.stringify({ enabled: true, clientId: "old" })
    )

    const outcome = await migrateLegacyUserDataReplica({
      userDataDirectory: userData,
      localDataDirectory: dataDirectory,
    })

    expect(outcome.kind).toBe("migrated")
    const migrated = localDatabasePath(dataDirectory)
    expect(snapshotAppTables(migrated)).toEqual(expected)
    expect(schemaObjects(migrated)).toEqual(schemaObjects(REFERENCE_DB))
    expect(sequenceRows(migrated)).not.toContain("_changelog")
    expect(() => assertDatabaseIntact(migrated)).not.toThrow()
  }, 120_000)
})

describe("同期のインスタンスを閉じる", () => {
  it("（前提の確認）閉じるまでは DB を開いた手が残り、close() で無くなる", async () => {
    const directory = path.join(TEST_ROOT, "close-check")
    const databasePath = path.join(directory, "database.db")
    await createSeededDatabase(databasePath)
    const sharedFolder = path.join(TEST_ROOT, "close-check-shared")
    fs.mkdirSync(sharedFolder, { recursive: true })
    const instance = await createAppSyncInstance({
      dbPath: databasePath,
      nasPath: getSharedFolderSyncDirectory(sharedFolder),
      clientId: crypto.randomUUID(),
      intervalMs: 600_000,
      changelogRetentionDays: 7,
    })
    await instance.syncNow()
    expect(openFilesUnder(directory).length).toBeGreaterThan(0)

    await instance.close()

    expect(openFilesUnder(directory)).toEqual([])
    fs.rmSync(directory, { recursive: true })
    expect(fs.existsSync(directory)).toBe(false)
  }, 120_000)
})
