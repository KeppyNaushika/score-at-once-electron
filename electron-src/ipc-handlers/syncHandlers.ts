/**
 * NAS同期 IPCハンドラー
 */

import { dialog } from "electron"

import {
  connectSharedFolder,
  getStorageOverview,
  inspectSharedFolderForSetup,
  migrateProfileToLocal,
  relaunchApp,
  selectStartupStorage,
  type SharedFolderConnectAction,
} from "../lib/sync/storageModeService"
import {
  getSyncStatus,
  triggerSyncNow,
  updateSyncTiming,
} from "../lib/sync/syncService"
import type { SyncAppConfig } from "../lib/sync/types"
import { type HandlerMap } from "./ipcHandlerUtils"

export const syncHandlers = {
  /** 設定と、いま動いている根 */
  "sync:getConfig": async () => getStorageOverview(),

  /** 同期の間隔・保持期間（モードは変えない） */
  "sync:setTiming": async (
    partial: Partial<
      Pick<SyncAppConfig, "intervalMs" | "changelogRetentionDays">
    >
  ) => {
    await updateSyncTiming(partial)
  },

  "sync:triggerNow": () => triggerSyncNow(),

  "sync:getStatus": async () => getSyncStatus(),

  /** 共有フォルダを選ぶ。選ばずに閉じたら null */
  "sync:chooseSharedFolder": async () => {
    const result = await dialog.showOpenDialog({
      title: "共有フォルダを選ぶ",
      properties: ["openDirectory", "createDirectory"],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  },

  /** 共有フォルダを見る（何も書かない） */
  "sync:inspectSharedFolder": async (sharedFolderPath: string) =>
    inspectSharedFolderForSetup(sharedFolderPath),

  /** 共有フォルダを登録し、次の起動でそのプロファイルを使う */
  "sync:connectSharedFolder": async (input: {
    sharedFolderPath: string
    action: SharedFolderConnectAction
  }) => connectSharedFolder(input),

  /** 次の起動で使うモード・プロファイルを選ぶ */
  "sync:selectStartupStorage": async (
    selection: { mode: "local" } | { mode: "shared"; sharedFolderId: string }
  ) => {
    selectStartupStorage(selection)
  },

  /** 共有プロファイルのデータを空のローカルモードへ移し、次の起動をローカルモードにする */
  "sync:migrateProfileToLocal": async (sharedFolderId: string) => {
    await migrateProfileToLocal(sharedFolderId)
  },

  /** 再起動する */
  "sync:relaunch": async () => {
    relaunchApp()
  },
} satisfies HandlerMap
