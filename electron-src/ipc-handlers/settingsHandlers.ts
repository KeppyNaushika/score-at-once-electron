/**
 * 設定関連のIPCハンドラー
 */

import { BrowserWindow, powerSaveBlocker } from "electron"

import type { ExamExportSettings } from "../lib/prisma/examSettings"
import {
  getExamExportSettings,
  upsertExamExportSettings,
} from "../lib/prisma/examSettings"
import {
  bulkUpsertUserKeyboardShortcuts,
  getUserKeyboardShortcuts,
  getUserPreference,
  resetUserKeyboardShortcuts,
  setUserPreference,
} from "../lib/prisma/userSettings"
import { registerEventHandler, registerHandler } from "./ipcHandlerUtils"

// プロジェクターモード用のpowerSaveBlocker ID
let projectorModeBlockerId: number | null = null

/** 設定（キーボードショートカット・採点マーク書式・表示設定・プロジェクターモード等）に関するIPCチャンネルを登録する */
export function registerSettingsHandlers() {
  // =========================================================================
  // プロジェクターモード（スクリーンセーバー無効化）
  // =========================================================================

  registerHandler("settings:setProjectorMode", async (enabled: boolean) => {
    const isBlocking =
      projectorModeBlockerId !== null &&
      powerSaveBlocker.isStarted(projectorModeBlockerId)

    if (enabled) {
      if (!isBlocking) {
        projectorModeBlockerId = powerSaveBlocker.start("prevent-display-sleep")
      }
      return true
    }

    if (isBlocking) {
      powerSaveBlocker.stop(projectorModeBlockerId!)
    }
    projectorModeBlockerId = null
    return false
  })

  registerHandler(
    "settings:getProjectorMode",
    async () =>
      projectorModeBlockerId !== null &&
      powerSaveBlocker.isStarted(projectorModeBlockerId)
  )

  // =========================================================================
  // フルスクリーン制御（event.sender からウィンドウを取るため event が要る）
  // =========================================================================

  registerEventHandler(
    "settings:getFullScreen",
    async (event) =>
      BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false
  )

  registerEventHandler(
    "settings:setFullScreen",
    async (event, enabled: boolean) => {
      BrowserWindow.fromWebContents(event.sender)?.setFullScreen(enabled)
    }
  )

  // =========================================================================
  // UserKeyboardShortcut
  // =========================================================================

  registerHandler("settings:getUserKeyboardShortcuts", (userId: string) =>
    getUserKeyboardShortcuts(userId)
  )

  // 書き込み系は件数を返さない。呼び出し側が使っておらず、返すと契約に
  // 意味の無い型が乗る
  registerHandler(
    "settings:saveUserKeyboardShortcuts",
    async (userId: string, shortcuts: Record<string, string>) => {
      await bulkUpsertUserKeyboardShortcuts(userId, shortcuts)
    }
  )

  registerHandler(
    "settings:resetUserKeyboardShortcuts",
    async (userId: string) => {
      await resetUserKeyboardShortcuts(userId)
    }
  )

  // =========================================================================
  // UserPreference（KV方式）
  // =========================================================================

  registerHandler("settings:getUserPreference", (userId: string, key: string) =>
    getUserPreference(userId, key)
  )

  registerHandler(
    "settings:setUserPreference",
    (userId: string, key: string, value: string) =>
      setUserPreference(userId, key, value)
  )

  // =========================================================================
  // ExamExportSettings
  // =========================================================================

  registerHandler("settings:getExamExportSettings", (examId: string) =>
    getExamExportSettings(examId)
  )

  registerHandler(
    "settings:saveExamExportSettings",
    (examId: string, settings: ExamExportSettings) =>
      upsertExamExportSettings(examId, settings)
  )
}
