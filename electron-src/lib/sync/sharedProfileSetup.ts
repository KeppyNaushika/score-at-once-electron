/**
 * 共有プロファイルの用意と、モードをまたぐ移行（issue #1322）
 *
 * ローカルモードと共有モードは別々の世界で、データを暗黙に行き来させない。
 * ここにあるのは、利用者が明示的に選んだときだけ走る4つの操作である。
 *
 * | 操作 | 前提 | すること |
 * | --- | --- | --- |
 * | {@link createEmptySharedProfile} | 共有フォルダが空 | 見本だけの新しい DB で共有を始め、同期の写しを上げる |
 * | {@link migrateLocalDataToSharedFolder} | 共有フォルダが空 | ローカルの DB と画像を丸写しして共有を始め、同期の写しを上げる |
 * | {@link joinSharedFolder} | 共有フォルダに識別ファイルがある | 共有フォルダの写しだけから手元の控えを作る |
 * | {@link migrateSharedProfileToLocal} | ローカルの data が空 | 手元の控えと共有フォルダの画像を、ローカルへ丸写しし、同期の仕組みを取り除く |
 *
 * **移行先が空でなければ断る。** 統合する機能は作らない（同じ生徒が別の id で入って
 * いることがあり、機械的に混ぜると取り返しがつかない）。統合したいときは、利用者が
 * アーカイブの書き出しと取り込みを使う。
 *
 * どの操作も、終わるまでは設定を変えない。設定（どのモード・どのプロファイルで
 * 起動するか）を書くのは呼び出し側で、効くのは再起動したとき（`../storageRoots.ts`）。
 * 失敗したら、自分が作ったものだけを片づけて例外を投げる。
 */

import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"
import type { SyncResult } from "sqlite-nas-sync"

import { createPrismaClientForPath } from "../prisma/databaseInitializer"
import { seedSampleData } from "../prisma/sampleSeed"
import { createBaseline } from "../prisma/schema/baselineMigrations"
import { deployPendingMigrations } from "../prisma/schema/migrationDeployer"
import { bootstrapSchema } from "../prisma/schema/schemaBootstrap"
import { openAppDatabase } from "../prisma/sqliteConnection"
import { assertDatabaseIntact, backupDatabaseFile } from "./databaseCopy"
import { findLocalUserData } from "./localDataEmptiness"
import {
  getSharedFolderFilesDirectory,
  getSharedFolderSyncDirectory,
  getSharedReplicaDatabasePath,
  getSharedReplicaDirectory,
  hasSyncCopies,
  inspectSharedFolder,
  readSharedFolderId,
  SHARED_FILE_DIRECTORIES,
  writeSharedFolderMarker,
} from "./sharedFolder"
import {
  createAppSyncInstance,
  removeSyncMachinery,
} from "./syncInstanceFactory"
import type { SharedProfile } from "./types"

/** 共有フォルダを扱う操作に共通の入力 */
export interface SharedFolderSetupContext {
  /** 実行ファイルの隣の data */
  localDataDirectory: string
  /** 利用者が選んだ共有フォルダ */
  sharedFolderPath: string
  /** このPCの clientId（同期の写しの名前になる） */
  clientId: string
  /** 同梱マイグレーションの場所（省略するとアプリの既定） */
  migrationsDir?: string
}

/** 作ったものの片づけ。逆順に消す。消せなくても例外にしない（元の失敗を隠さない） */
class CreatedEntries {
  private readonly entries: Array<{ path: string; recursive: boolean }> = []

  /** 中身ごと消してよいもの（自分だけが作った） */
  addTree(entryPath: string): void {
    this.entries.push({ path: entryPath, recursive: true })
  }

  /** 空のときだけ消すもの（同時に他のPCが使い始めているかもしれない） */
  addDirectoryIfEmpty(entryPath: string): void {
    this.entries.push({ path: entryPath, recursive: false })
  }

  /** 片づける。消せなかったパスを返す */
  removeAll(): string[] {
    return [...this.entries].reverse().flatMap((entry) => {
      try {
        if (entry.recursive) {
          fs.rmSync(entry.path, { recursive: true, force: true })
        } else if (fs.existsSync(entry.path)) {
          fs.rmdirSync(entry.path)
        }
        return []
      } catch (error) {
        console.warn(`Failed to clean up: ${entry.path}`, error)
        return [entry.path]
      }
    })
  }
}

/** ディレクトリが無ければ作り、作ったなら片づけの対象に積む */
function ensureDirectory(
  directoryPath: string,
  created: CreatedEntries,
  removal: "tree" | "if-empty"
): void {
  if (fs.existsSync(directoryPath)) return
  fs.mkdirSync(directoryPath, { recursive: true })
  if (removal === "tree") created.addTree(directoryPath)
  else created.addDirectoryIfEmpty(directoryPath)
}

/** 共有フォルダが空であることを確かめる。空でなければ例外 */
function assertSharedFolderEmpty(sharedFolderPath: string): void {
  const inspection = inspectSharedFolder(sharedFolderPath)
  if (inspection.kind === "empty") return
  if (inspection.kind === "shared") {
    throw new Error(
      "この共有フォルダには既に共有しているデータがあります。移行先にできるのは空の共有フォルダだけです。" +
        "統合したい場合は、アーカイブの書き出しと取り込みを使ってください。"
    )
  }
  throw new Error(`この共有フォルダは使えません: ${inspection.reason}`)
}

/**
 * スキーマだけの空の DB を作る（新規インストールと同じ経路: init → ベースライン →
 * 未適用マイグレーション）。見本は入れない。
 */
async function createSchemaOnlyDatabase(
  databasePath: string,
  migrationsDir: string | undefined
): Promise<void> {
  if (bootstrapSchema(databasePath) !== "created") {
    throw new Error(`DB が既にあります: ${databasePath}`)
  }
  const prisma = createPrismaClientForPath(databasePath)
  try {
    await createBaseline(prisma)
  } finally {
    await prisma.$disconnect()
  }
  deployPendingMigrations({ migrationsDir, dbPath: databasePath })
}

/**
 * 共有フォルダの骨組み（sync / files）を作り、手元の控えから同期の写しを上げ、
 * 最後に識別ファイルを置く。
 *
 * 写しを上げるのは、共有モードの起動時と同じライブラリの経路（`setupSync` → `syncNow`）。
 * 上げ終えた時点で、別のPCが合流できる（合流は写しが1つも無い共有フォルダを断る）。
 * 写しと、ライブラリが置く一時ファイル（`client-<clientId>.sqlite.tmp`。
 * `sqlite-nas-sync` の `nas.ts` の `copyToNas`）は、失敗したときの片づけに積む。
 */
async function publishAndFinishSharedFolder(
  context: SharedFolderSetupContext,
  sharedFolderId: string,
  replicaPath: string,
  created: CreatedEntries
): Promise<void> {
  const syncDirectory = getSharedFolderSyncDirectory(context.sharedFolderPath)
  ensureDirectory(syncDirectory, created, "if-empty")
  ensureDirectory(
    getSharedFolderFilesDirectory(context.sharedFolderPath),
    created,
    "if-empty"
  )
  const copyPath = path.join(syncDirectory, `client-${context.clientId}.sqlite`)
  created.addTree(copyPath)
  created.addTree(`${copyPath}.tmp`)
  const instance = await createAppSyncInstance({
    dbPath: replicaPath,
    nasPath: syncDirectory,
    clientId: context.clientId,
    intervalMs: 600_000,
    changelogRetentionDays: 7,
  })
  try {
    await instance.syncNow()
  } finally {
    // 失敗したときの片づけは控えを消すので、その前に必ず閉じる
    await instance.close()
  }
  if (!fs.existsSync(copyPath)) {
    throw new Error(`同期の写しを共有フォルダに置けませんでした: ${copyPath}`)
  }
  // 識別ファイルは最後。これがある＝用意が終わった、という印になる
  writeSharedFolderMarker(context.sharedFolderPath, sharedFolderId)
}

/** 失敗したときの片づけと、例外の組み立て */
function failWithCleanup(error: unknown, created: CreatedEntries): never {
  const leftovers = created.removeAll()
  const message = error instanceof Error ? error.message : String(error)
  throw new Error(
    leftovers.length > 0
      ? `${message}\n片づけられなかったもの: ${leftovers.join(", ")}`
      : message,
    { cause: error }
  )
}

/**
 * 空の共有フォルダで、新しい空の共有プロファイルを始める。
 *
 * 手元の控えは見本だけの新しい DB。見本はここで1度だけ入れる（共有モードの起動では
 * 入れない。入れると、合流したPCが起動するたびに見本が全員へ渡る）。
 */
export async function createEmptySharedProfile(
  context: SharedFolderSetupContext
): Promise<SharedProfile> {
  assertSharedFolderEmpty(context.sharedFolderPath)
  const sharedFolderId = crypto.randomUUID()
  const created = new CreatedEntries()
  try {
    const replicaDirectory = getSharedReplicaDirectory(
      context.localDataDirectory,
      sharedFolderId
    )
    ensureDirectory(replicaDirectory, created, "tree")
    const replicaPath = getSharedReplicaDatabasePath(
      context.localDataDirectory,
      sharedFolderId
    )
    await createSchemaOnlyDatabase(replicaPath, context.migrationsDir)
    const prisma = createPrismaClientForPath(replicaPath)
    try {
      await seedSampleData(prisma)
    } finally {
      await prisma.$disconnect()
    }
    await publishAndFinishSharedFolder(
      context,
      sharedFolderId,
      replicaPath,
      created
    )
  } catch (error) {
    failWithCleanup(error, created)
  }
  return { sharedFolderId, sharedFolderPath: context.sharedFolderPath }
}

/**
 * ローカルモードのデータ（DB と画像）を、空の共有フォルダへ丸写しして共有を始める。
 *
 * ローカルのデータは写すだけで、消しも変えもしない。写したあとにローカルモードで
 * 加えた変更は、共有プロファイルへは渡らない（2つは別の世界）。
 */
export async function migrateLocalDataToSharedFolder(
  context: SharedFolderSetupContext
): Promise<SharedProfile> {
  assertSharedFolderEmpty(context.sharedFolderPath)
  const localDatabasePath = path.join(context.localDataDirectory, "database.db")
  if (!fs.existsSync(localDatabasePath)) {
    throw new Error(`ローカルモードの DB がありません: ${localDatabasePath}`)
  }
  const sharedFolderId = crypto.randomUUID()
  const created = new CreatedEntries()
  try {
    const replicaDirectory = getSharedReplicaDirectory(
      context.localDataDirectory,
      sharedFolderId
    )
    ensureDirectory(replicaDirectory, created, "tree")
    const replicaPath = getSharedReplicaDatabasePath(
      context.localDataDirectory,
      sharedFolderId
    )
    await backupDatabaseFile(localDatabasePath, replicaPath)
    // ローカルの DB に以前の同期の仕組みが残っていても（旧版で同期を切った DB など）、
    // 新しい共有フォルダの履歴はまっさらから始める。仕組みは写しを上げるときに
    // ライブラリが作り直し、アプリの表の行から版を起こす
    await removeSyncMachinery(replicaPath)
    assertDatabaseIntact(replicaPath)

    const filesDirectory = getSharedFolderFilesDirectory(
      context.sharedFolderPath
    )
    ensureDirectory(filesDirectory, created, "if-empty")
    for (const directoryName of SHARED_FILE_DIRECTORIES) {
      const source = path.join(context.localDataDirectory, directoryName)
      if (!fs.existsSync(source)) continue
      const destination = path.join(filesDirectory, directoryName)
      // 共有フォルダの files は空だと確かめてあるので、ここで写すものは全部自分のもの
      created.addTree(destination)
      fs.cpSync(source, destination, {
        recursive: true,
        errorOnExist: true,
        force: false,
      })
    }
    await publishAndFinishSharedFolder(
      context,
      sharedFolderId,
      replicaPath,
      created
    )
  } catch (error) {
    failWithCleanup(error, created)
  }
  return { sharedFolderId, sharedFolderPath: context.sharedFolderPath }
}

/** 合流の1回きりの同期の結果を読み、追いつけていなければ理由を返す */
function describeJoinFailure(
  result: SyncResult,
  replicaPath: string
): string | null {
  const blocking = result.warnings.filter(
    (warning) =>
      warning.startsWith("Rebuild failed") ||
      warning.startsWith("Rebuild deferred")
  )
  if (blocking.length > 0) {
    return `共有フォルダの内容を手元の控えへ反映できませんでした: ${blocking.join(" / ")}`
  }
  if (result.clientsSynced === 0 && result.skippedRemotes.length > 0) {
    const newer = result.skippedRemotes.some(
      (remote) =>
        remote.remoteVersion !== null &&
        remote.remoteVersion > remote.localVersion
    )
    return newer
      ? "共有フォルダのデータは、このPCより新しい版のアプリで作られています。このPCのアプリを更新してから、もう一度選んでください。"
      : "共有フォルダのデータは、このPCより古い版のアプリで作られています。共有しているPCのアプリを更新してから、もう一度選んでください。"
  }
  if (result.clientsSynced === 0) {
    return "共有フォルダの同期の写しを1つも読めませんでした。"
  }
  const db = openAppDatabase(replicaPath)
  try {
    const row = db
      .prepare<[], { count: number }>(`SELECT COUNT(*) AS count FROM "User"`)
      .get()
    if (row === undefined || row.count === 0) {
      return "共有フォルダから利用者を1人も読み込めませんでした。"
    }
  } finally {
    db.close()
  }
  return null
}

/**
 * 既に共有されているフォルダに合流する。
 *
 * **このPCのローカルのデータとは統合しない。** 手元の控えは、空の DB にマイグレーションを
 * 当て、共有フォルダの全クライアントの写しから読み込んで作る（sqlite-nas-sync は、
 * まだ一度も読んでいない相手を必ずフルマージで読む。`rows-sync.ts` の `needsFullMerge`）。
 *
 * このPCが以前にも同じ共有フォルダを使っていて控えが残っていれば、それを使い続ける
 * （同じ共有フォルダの履歴なので、混ぜることにはならない）。
 *
 * @param clientId - このPCの clientId
 * @returns 合流したプロファイルと、版が違って読まなかった相手の数
 */
export async function joinSharedFolder(
  context: SharedFolderSetupContext
): Promise<{ profile: SharedProfile; skippedRemoteCount: number }> {
  const sharedFolderId = readSharedFolderId(context.sharedFolderPath)
  if (sharedFolderId === null) {
    throw new Error("この共有フォルダには識別ファイルがありません。")
  }
  if (!hasSyncCopies(context.sharedFolderPath)) {
    throw new Error(
      "この共有フォルダには、まだ同期の写しがありません。共有を始めたPCで、共有モードで一度起動してから選んでください。"
    )
  }
  const replicaPath = getSharedReplicaDatabasePath(
    context.localDataDirectory,
    sharedFolderId
  )
  const created = new CreatedEntries()
  try {
    if (!fs.existsSync(replicaPath)) {
      ensureDirectory(
        getSharedReplicaDirectory(context.localDataDirectory, sharedFolderId),
        created,
        "tree"
      )
      await createSchemaOnlyDatabase(replicaPath, context.migrationsDir)
    }
    // 1回だけ同期する。インスタンスは定期実行を始めない（`start()` を呼ばない）
    const instance = await createAppSyncInstance({
      dbPath: replicaPath,
      nasPath: getSharedFolderSyncDirectory(context.sharedFolderPath),
      clientId: context.clientId,
      intervalMs: 600_000,
      changelogRetentionDays: 7,
    })
    let result: SyncResult
    try {
      result = await instance.syncNow()
    } finally {
      // 失敗したときの片づけは控えを消すので、その前に必ず閉じる
      await instance.close()
    }
    const failure = describeJoinFailure(result, replicaPath)
    if (failure !== null) throw new Error(failure)
    return {
      profile: { sharedFolderId, sharedFolderPath: context.sharedFolderPath },
      skippedRemoteCount: result.skippedRemotes.length,
    }
  } catch (error) {
    failWithCleanup(error, created)
  }
}

/**
 * 共有プロファイルのデータ（手元の控えと共有フォルダの画像）を、ローカルモードへ丸写しする。
 *
 * **ローカルの data が空のときだけ**（`localDataEmptiness.ts`）。ローカルモードで
 * 動いている間は呼ばないこと（`data/database.db` を開いている）。
 *
 * 写した DB からは同期の仕組みを取り除く（ライブラリの `removeSync`）。
 * 共有フォルダには何も書かない（離脱ではない。このPCが共有をやめても、他のPCの
 * 同期はそのまま続く）。
 */
export async function migrateSharedProfileToLocal({
  localDataDirectory,
  profile,
}: {
  localDataDirectory: string
  profile: SharedProfile
}): Promise<void> {
  const found = findLocalUserData(localDataDirectory)
  if (found.length > 0) {
    throw new Error(
      `ローカルモードに既にデータがあります（${found.join("・")}）。移行先にできるのは空のローカルモードだけです。` +
        "統合したい場合は、アーカイブの書き出しと取り込みを使ってください。"
    )
  }
  if (readSharedFolderId(profile.sharedFolderPath) !== profile.sharedFolderId) {
    throw new Error(
      `共有フォルダ（${profile.sharedFolderPath}）が見つからないか、別の共有フォルダになっています。画像を写せないので移行できません。`
    )
  }
  const replicaPath = getSharedReplicaDatabasePath(
    localDataDirectory,
    profile.sharedFolderId
  )
  if (!fs.existsSync(replicaPath)) {
    throw new Error(`このプロファイルの手元の控えがありません: ${replicaPath}`)
  }

  const created = new CreatedEntries()
  try {
    // 画像を先に写す。DB の置き換えに失敗したら、写した画像を片づける
    // （移行先は「画像が1つも無い」ことを確かめてあるので、写したものは全部自分のもの）
    const filesDirectory = getSharedFolderFilesDirectory(
      profile.sharedFolderPath
    )
    for (const directoryName of SHARED_FILE_DIRECTORIES) {
      const source = path.join(filesDirectory, directoryName)
      if (!fs.existsSync(source)) continue
      const destination = path.join(localDataDirectory, directoryName)
      created.addTree(destination)
      fs.cpSync(source, destination, { recursive: true, force: false })
    }
    const localDatabasePath = path.join(localDataDirectory, "database.db")
    await backupDatabaseFile(replicaPath, localDatabasePath)
    // ローカルモードは同期と切り分けた世界なので、同期の仕組みを残さない
    await removeSyncMachinery(localDatabasePath)
    assertDatabaseIntact(localDatabasePath)
  } catch (error) {
    failWithCleanup(error, created)
  }
}
