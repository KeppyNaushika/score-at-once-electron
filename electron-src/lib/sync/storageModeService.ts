/**
 * モードと共有プロファイルの設定を変える（設定画面の同期タブから呼ぶ）
 *
 * どれも**設定を書くだけで、動いている間の根は変えない**（`../storageRoots.ts`）。
 * 効くのは再起動したときで、画面から再起動できる（`relaunchApp`）。
 */

import { app } from "electron"

import { getLocalDataDirectory } from "../dataManager"
import { getStorageRoots } from "../storageRoots"
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
  return connected
}

/** 次の起動で使うモード・プロファイルを選ぶ */
export function selectStartupStorage(
  selection: { mode: "local" } | { mode: "shared"; sharedFolderId: string }
): void {
  const config = loadSyncConfig()
  if (selection.mode === "local") {
    saveSyncConfig({ ...config, mode: "local" })
    return
  }
  if (
    !config.sharedProfiles.some(
      (profile) => profile.sharedFolderId === selection.sharedFolderId
    )
  ) {
    throw new Error("その共有プロファイルは登録されていません")
  }
  saveSyncConfig({
    ...config,
    mode: "shared",
    activeSharedFolderId: selection.sharedFolderId,
  })
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
}

/** アプリを再起動する（モード・プロファイルの切り替えを効かせる） */
export function relaunchApp(): void {
  app.relaunch()
  app.quit()
}
