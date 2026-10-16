/**
 * モードと共有プロファイルの設定を変える（同期設定の画面から呼ぶ）
 *
 * どれも**設定を書くだけで、動いている間の根は変えない**（`../storageRoots.ts`）。
 * 効くのは再起動したときで、画面から再起動できる（`relaunchApp`）。
 */

import { app } from "electron"

import {
  isSyncConsentCurrent,
  SYNC_CONSENT_VERSION,
} from "../../../src/lib/shared/syncConsentText"
import { getLocalDataDirectory } from "../dataManager"
import { getCurrentActorUserId } from "../prisma/auditActor"
import { resolveUserLabel } from "../prisma/auditScope"
import { getStorageRoots } from "../storageRoots"
import { getCurrentClientIdOwner } from "./machineIdentity"
import {
  inspectSharedFolder,
  type SharedFolderInspection,
} from "./sharedFolder"
import {
  createEmptySharedProfile,
  joinSharedFolder,
  migrateLocalDataToSharedFolder,
  migrateSharedProfileToLocal,
} from "./sharedProfileSetup"
import {
  loadSyncConfig,
  saveSyncConfig,
  upsertSharedProfile,
} from "./syncConfig"
import {
  appendSyncSetupAuditEntry,
  createSyncSetupAuditEntry,
  type SyncSetupAuditEvent,
} from "./syncSetupAuditLog"
import type { SharedProfile, StorageMode, SyncAppConfig } from "./types"

/** 共有フォルダを登録するときの選び方 */
export type SharedFolderConnectAction =
  /** 空の共有フォルダで、見本だけの新しいプロファイルを始める */
  | "create-empty"
  /** 空の共有フォルダへ、ローカルモードのデータを丸写しして始める */
  | "migrate-local"
  /** 既に共有されているフォルダに合流する */
  | "join"

/** 設定と、いま動いている根（画面はこの2つを見比べて「再起動待ち」を出す） */
export function getStorageOverview(): {
  config: SyncAppConfig
  running: {
    mode: StorageMode
    sharedFolder: SharedProfile | null
    databasePath: string
    sharedFilesDirectory: string
    localDataDirectory: string
  }
} {
  const roots = getStorageRoots()
  return {
    config: loadSyncConfig(),
    running: {
      mode: roots.mode,
      sharedFolder: roots.sharedFolder,
      databasePath: roots.databasePath,
      sharedFilesDirectory: roots.sharedFilesDirectory,
      localDataDirectory: roots.localDataDirectory,
    },
  }
}

/**
 * 同意・設定の変更を監査ログへ残す（`syncSetupAuditLog.ts`）。操作した人は、いま動いて
 * いる DB でログインしている利用者。
 *
 * @param sharedFolderPath - 出来事が関わる共有フォルダ。その共有フォルダにも同じ記録を書く
 */
async function recordSyncSetupEvent(
  event: SyncSetupAuditEvent,
  sharedFolderPath: string | null
): Promise<void> {
  const roots = getStorageRoots()
  const userId = getCurrentActorUserId()
  const entry = createSyncSetupAuditEntry({
    actor:
      userId === null
        ? null
        : { userId, userName: await resolveUserLabel(userId) },
    runningMode: roots.mode,
    runningSharedFolderId: roots.sharedFolder?.sharedFolderId ?? null,
    clientId: loadSyncConfig().clientId,
    hostname: getCurrentClientIdOwner().hostname,
    event,
  })
  appendSyncSetupAuditEntry(entry, {
    localDataDirectory: getLocalDataDirectory(),
    sharedFolderPath,
  })
}

/**
 * このPCが今の版の同意文に同意したことを記録する。版と clientId は renderer から
 * 受け取らない（古い版や別のPCの名で同意できないように）。
 *
 * 共有モードで動いていれば、監査ログはその共有フォルダにも書く。まだ共有フォルダを
 * 選ぶ前の同意は、登録したときの記録（`connect-shared-folder` の `consent`）で共有フォルダに届く。
 */
export async function recordSyncConsent(): Promise<void> {
  const config = loadSyncConfig()
  if (config.clientId === "") {
    throw new Error(
      "このPCの clientId がまだ決まっていないため、同意を記録できません"
    )
  }
  saveSyncConfig({
    ...config,
    syncConsent: {
      clientId: config.clientId,
      consentVersion: SYNC_CONSENT_VERSION,
      consentedAt: new Date().toISOString(),
    },
  })
  await recordSyncSetupEvent(
    { kind: "consent", consentVersion: SYNC_CONSENT_VERSION },
    getStorageRoots().sharedFolder?.sharedFolderPath ?? null
  )
}

/**
 * 共有モードへ入る操作（共有フォルダの登録・起動先を共有にする）の前に、同意を確かめる。
 *
 * 断るのは**利用者がこれから入る操作だけ**。いま共有モードで動いている同期は止めない
 * （同意の画面は起動のたびに出す。`SyncConsentReminder`）。
 */
function assertSyncConsent(config: SyncAppConfig): void {
  if (!isSyncConsentCurrent(config)) {
    throw new Error(
      "共有モードの注意事項に同意していないため、共有モードを選べません"
    )
  }
}

/** 共有フォルダを見る（何も書かない） */
export function inspectSharedFolderForSetup(
  sharedFolderPath: string
): SharedFolderInspection {
  return inspectSharedFolder(sharedFolderPath)
}

/**
 * 共有フォルダを登録し、次の起動でそのプロファイルを使うように設定する。
 *
 * 同じ共有フォルダ（識別 id が同じ）が既に登録されていれば、パスを書き換えて使う
 * （PCでドライブの割り当てを変えた場合など）。
 */
export async function connectSharedFolder({
  sharedFolderPath,
  action,
}: {
  sharedFolderPath: string
  action: SharedFolderConnectAction
}): Promise<{ profile: SharedProfile; skippedRemoteCount: number }> {
  const localDataDirectory = getLocalDataDirectory()
  const config = loadSyncConfig()
  assertSyncConsent(config)
  const context = {
    localDataDirectory,
    sharedFolderPath,
    clientId: config.clientId,
  }

  let connected: { profile: SharedProfile; skippedRemoteCount: number }
  if (action === "create-empty") {
    connected = {
      profile: await createEmptySharedProfile(context),
      skippedRemoteCount: 0,
    }
  } else if (action === "migrate-local") {
    connected = {
      profile: await migrateLocalDataToSharedFolder(context),
      skippedRemoteCount: 0,
    }
  } else {
    const inspection = inspectSharedFolder(sharedFolderPath)
    const running = getStorageRoots().sharedFolder
    if (
      inspection.kind === "shared" &&
      running !== null &&
      running.sharedFolderId === inspection.sharedFolderId
    ) {
      // いま動いているプロファイルの共有フォルダ。控えは同期中なので作り直さない
      connected = {
        profile: {
          sharedFolderId: inspection.sharedFolderId,
          sharedFolderPath,
        },
        skippedRemoteCount: 0,
      }
    } else {
      connected = await joinSharedFolder(context)
    }
  }

  saveSyncConfig({
    ...upsertSharedProfile(config, connected.profile),
    mode: "shared",
    activeSharedFolderId: connected.profile.sharedFolderId,
  })
  await recordSyncSetupEvent(
    {
      kind: "connect-shared-folder",
      action,
      reregistered: config.sharedProfiles.some(
        (profile) => profile.sharedFolderId === connected.profile.sharedFolderId
      ),
      sharedFolderId: connected.profile.sharedFolderId,
      sharedFolderPath: connected.profile.sharedFolderPath,
      consent: config.syncConsent,
    },
    connected.profile.sharedFolderPath
  )
  return connected
}

/** 次の起動で使うモード・プロファイルを選ぶ */
export async function selectStartupStorage(
  selection: { mode: "local" } | { mode: "shared"; sharedFolderId: string }
): Promise<void> {
  const config = loadSyncConfig()
  if (selection.mode === "local") {
    saveSyncConfig({ ...config, mode: "local" })
    await recordSyncSetupEvent(
      { kind: "select-startup-storage", mode: "local", sharedFolderId: null },
      null
    )
    return
  }
  assertSyncConsent(config)
  const profile = config.sharedProfiles.find(
    (candidate) => candidate.sharedFolderId === selection.sharedFolderId
  )
  if (profile === undefined) {
    throw new Error("その共有プロファイルは登録されていません")
  }
  saveSyncConfig({
    ...config,
    mode: "shared",
    activeSharedFolderId: selection.sharedFolderId,
  })
  await recordSyncSetupEvent(
    {
      kind: "select-startup-storage",
      mode: "shared",
      sharedFolderId: profile.sharedFolderId,
    },
    profile.sharedFolderPath
  )
}

/**
 * 共有プロファイルのデータを、空のローカルモードへ丸写しし、次の起動をローカルモードにする。
 *
 * ローカルモードで動いている間は断る（`data/database.db` を開いているので置き換えられない）。
 */
export async function migrateProfileToLocal(
  sharedFolderId: string
): Promise<void> {
  if (getStorageRoots().mode === "local") {
    throw new Error(
      "ローカルモードで動いている間は、ローカルモードへ移行できません。移したい共有プロファイルで起動してから行ってください。"
    )
  }
  const config = loadSyncConfig()
  const profile = config.sharedProfiles.find(
    (candidate) => candidate.sharedFolderId === sharedFolderId
  )
  if (profile === undefined) {
    throw new Error("その共有プロファイルは登録されていません")
  }
  await migrateSharedProfileToLocal({
    localDataDirectory: getLocalDataDirectory(),
    profile,
  })
  saveSyncConfig({ ...config, mode: "local" })
  await recordSyncSetupEvent(
    { kind: "migrate-profile-to-local", sharedFolderId },
    profile.sharedFolderPath
  )
}

/** アプリを再起動する（モード・プロファイルの切り替えを効かせる） */
export function relaunchApp(): void {
  app.relaunch()
  app.quit()
}
