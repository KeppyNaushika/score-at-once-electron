/**
 * 設定関連のIPCハンドラー
 */

import { BrowserWindow, ipcMain, powerSaveBlocker } from "electron"

import {
  bulkUpsertExamMarkingFormats,
  getExamExportSettings,
  getExamMarkingFormats,
  type MarkingFormatData,
  upsertExamExportSettings,
} from "../lib/prisma/examSettings"
import {
  bulkUpsertUserKeyboardShortcuts,
  getUserKeyboardShortcuts,
  getUserPreference,
  getUserPreferences,
  resetUserKeyboardShortcuts,
  setUserPreference,
} from "../lib/prisma/userSettings"
import { registerSafeHandler } from "./ipcHandlerUtils"

// プロジェクターモード用のpowerSaveBlocker ID
let projectorModeBlockerId: number | null = null

/** 設定（キーボードショートカット・採点マーク書式・表示設定・プロジェクターモード等）に関するIPCチャンネルを登録する */
export function registerSettingsHandlers() {
  // =========================================================================
  // プロジェクターモード（スクリーンセーバー無効化）
  // =========================================================================

  registerSafeHandler("settings:setProjectorMode", async (enabled: boolean) => {
    if (enabled) {
      if (
        projectorModeBlockerId !== null &&
        powerSaveBlocker.isStarted(projectorModeBlockerId)
      ) {
        return { success: true, active: true }
      }
      projectorModeBlockerId = powerSaveBlocker.start("prevent-display-sleep")
      return { success: true, active: true }
    } else {
      if (
        projectorModeBlockerId !== null &&
        powerSaveBlocker.isStarted(projectorModeBlockerId)
      ) {
        powerSaveBlocker.stop(projectorModeBlockerId)
      }
      projectorModeBlockerId = null
      return { success: true, active: false }
    }
  })

  registerSafeHandler("settings:getProjectorMode", async () => {
    const active =
      projectorModeBlockerId !== null &&
      powerSaveBlocker.isStarted(projectorModeBlockerId)
    return { success: true, active }
  })

  // =========================================================================
  // フルスクリーン制御
  // NOTE: These handlers use event.sender to get the BrowserWindow,
  //       so they cannot use the registerHandler wrapper.
  // =========================================================================

  ipcMain.handle("settings:getFullScreen", async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      return { success: true, fullScreen: win?.isFullScreen() ?? false }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle("settings:setFullScreen", async (event, enabled: boolean) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) {
        win.setFullScreen(enabled)
      }
      return { success: true }
    } catch (error) {
      console.error("Error in IPC handler [settings:setFullScreen]:", error)
      return { success: false, error: String(error) }
    }
  })

  // =========================================================================
  // UserKeyboardShortcut
  // =========================================================================

  registerSafeHandler(
    "settings:getUserKeyboardShortcuts",
    async (userId: string) => {
      const shortcuts = await getUserKeyboardShortcuts(userId)
      return { success: true, shortcuts }
    }
  )

  registerSafeHandler(
    "settings:saveUserKeyboardShortcuts",
    async (userId: string, shortcuts: Record<string, string>) => {
      await bulkUpsertUserKeyboardShortcuts(userId, shortcuts)
      return { success: true }
    }
  )

  registerSafeHandler(
    "settings:resetUserKeyboardShortcuts",
    async (userId: string) => {
      await resetUserKeyboardShortcuts(userId)
      return { success: true }
    }
  )

  // =========================================================================
  // UserPreference（KV方式）
  // =========================================================================

  registerSafeHandler(
    "settings:getUserPreference",
    async (userId: string, key: string) => {
      const value = await getUserPreference(userId, key)
      return { success: true, value }
    }
  )

  registerSafeHandler(
    "settings:setUserPreference",
    async (userId: string, key: string, value: string) => {
      await setUserPreference(userId, key, value)
      return { success: true }
    }
  )

  registerSafeHandler("settings:getUserPreferences", async (userId: string) => {
    const preferences = await getUserPreferences(userId)
    return { success: true, preferences }
  })

  // =========================================================================
  // ExamMarkingFormat
  // =========================================================================

  registerSafeHandler(
    "settings:getExamMarkingFormats",
    async (examId: string) => {
      const formats = await getExamMarkingFormats(examId)
      return { success: true, formats }
    }
  )

  registerSafeHandler(
    "settings:saveExamMarkingFormats",
    async (examId: string, formats: MarkingFormatData[]) => {
      await bulkUpsertExamMarkingFormats(examId, formats)
      return { success: true }
    }
  )

  // =========================================================================
  // ExamExportSettings
  // =========================================================================

  registerSafeHandler(
    "settings:getExamExportSettings",
    async (examId: string) => {
      const settings = await getExamExportSettings(examId)
      return { success: true, settings }
    }
  )

  registerSafeHandler(
    "settings:saveExamExportSettings",
    async (examId: string, settings: Record<string, unknown>) => {
      await upsertExamExportSettings(examId, settings)
      return { success: true }
    }
  )
}
