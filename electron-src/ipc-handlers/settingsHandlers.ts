/**
 * 設定関連のIPCハンドラー
 */

import { BrowserWindow, ipcMain, powerSaveBlocker } from "electron"

import {
  bulkUpsertCropRegionMarkingOverrides,
  getCropRegionMarkingOverrides,
  getExamCropRegionMarkingOverrides,
  type MarkingOverrideData,
  resetCropRegionMarkingOverrides,
} from "../lib/prisma/cropRegionMarkingOverride"
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

// プロジェクターモード用のpowerSaveBlocker ID
let projectorModeBlockerId: number | null = null

export function registerSettingsHandlers() {
  // =========================================================================
  // プロジェクターモード（スクリーンセーバー無効化）
  // =========================================================================

  ipcMain.handle(
    "settings:setProjectorMode",
    async (_event, enabled: boolean) => {
      try {
        if (enabled) {
          if (
            projectorModeBlockerId !== null &&
            powerSaveBlocker.isStarted(projectorModeBlockerId)
          ) {
            return { success: true, active: true }
          }
          projectorModeBlockerId = powerSaveBlocker.start(
            "prevent-display-sleep"
          )
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
      } catch (error) {
        console.error("Failed to set projector mode:", error)
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle("settings:getProjectorMode", async () => {
    const active =
      projectorModeBlockerId !== null &&
      powerSaveBlocker.isStarted(projectorModeBlockerId)
    return { success: true, active }
  })

  // =========================================================================
  // フルスクリーン制御
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
      console.error("Failed to set fullscreen:", error)
      return { success: false, error: String(error) }
    }
  })

  // =========================================================================
  // UserKeyboardShortcut
  // =========================================================================

  ipcMain.handle(
    "settings:getUserKeyboardShortcuts",
    async (_event, userId: string) => {
      try {
        const shortcuts = await getUserKeyboardShortcuts(userId)
        return { success: true, shortcuts }
      } catch (error) {
        console.error("Failed to get keyboard shortcuts:", error)
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    "settings:saveUserKeyboardShortcuts",
    async (_event, userId: string, shortcuts: Record<string, string>) => {
      try {
        await bulkUpsertUserKeyboardShortcuts(userId, shortcuts)
        return { success: true }
      } catch (error) {
        console.error("Failed to save keyboard shortcuts:", error)
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    "settings:resetUserKeyboardShortcuts",
    async (_event, userId: string) => {
      try {
        await resetUserKeyboardShortcuts(userId)
        return { success: true }
      } catch (error) {
        console.error("Failed to reset keyboard shortcuts:", error)
        return { success: false, error: String(error) }
      }
    }
  )

  // =========================================================================
  // UserPreference（KV方式）
  // =========================================================================

  ipcMain.handle(
    "settings:getUserPreference",
    async (_event, userId: string, key: string) => {
      try {
        const value = await getUserPreference(userId, key)
        return { success: true, value }
      } catch (error) {
        console.error(`Failed to get user preference [${key}]:`, error)
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    "settings:setUserPreference",
    async (_event, userId: string, key: string, value: string) => {
      try {
        await setUserPreference(userId, key, value)
        return { success: true }
      } catch (error) {
        console.error(`Failed to set user preference [${key}]:`, error)
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    "settings:getUserPreferences",
    async (_event, userId: string) => {
      try {
        const preferences = await getUserPreferences(userId)
        return { success: true, preferences }
      } catch (error) {
        console.error("Failed to get user preferences:", error)
        return { success: false, error: String(error) }
      }
    }
  )

  // =========================================================================
  // ExamMarkingFormat
  // =========================================================================

  ipcMain.handle(
    "settings:getExamMarkingFormats",
    async (_event, examId: string) => {
      try {
        const formats = await getExamMarkingFormats(examId)
        return { success: true, formats }
      } catch (error) {
        console.error("Failed to get marking formats:", error)
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    "settings:saveExamMarkingFormats",
    async (_event, examId: string, formats: MarkingFormatData[]) => {
      try {
        await bulkUpsertExamMarkingFormats(examId, formats)
        return { success: true }
      } catch (error) {
        console.error("Failed to save marking formats:", error)
        return { success: false, error: String(error) }
      }
    }
  )

  // =========================================================================
  // ExamExportSettings
  // =========================================================================

  ipcMain.handle(
    "settings:getExamExportSettings",
    async (_event, examId: string) => {
      try {
        const settings = await getExamExportSettings(examId)
        return { success: true, settings }
      } catch (error) {
        console.error("Failed to get export settings:", error)
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    "settings:saveExamExportSettings",
    async (_event, examId: string, settings: Record<string, unknown>) => {
      try {
        await upsertExamExportSettings(examId, settings)
        return { success: true }
      } catch (error) {
        console.error("Failed to save export settings:", error)
        return { success: false, error: String(error) }
      }
    }
  )

  // =========================================================================
  // CropRegionMarkingOverride (機能H)
  // =========================================================================

  ipcMain.handle(
    "settings:getCropRegionMarkingOverrides",
    async (_event, cropRegionId: string) => {
      try {
        const overrides = await getCropRegionMarkingOverrides(cropRegionId)
        return { success: true, overrides }
      } catch (error) {
        console.error("Failed to get marking overrides:", error)
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    "settings:saveCropRegionMarkingOverrides",
    async (_event, cropRegionId: string, overrides: MarkingOverrideData[]) => {
      try {
        await bulkUpsertCropRegionMarkingOverrides(cropRegionId, overrides)
        return { success: true }
      } catch (error) {
        console.error("Failed to save marking overrides:", error)
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    "settings:resetCropRegionMarkingOverrides",
    async (_event, cropRegionId: string) => {
      try {
        await resetCropRegionMarkingOverrides(cropRegionId)
        return { success: true }
      } catch (error) {
        console.error("Failed to reset marking overrides:", error)
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    "settings:getExamCropRegionMarkingOverrides",
    async (_event, examId: string) => {
      try {
        const overrides = await getExamCropRegionMarkingOverrides(examId)
        return { success: true, overrides }
      } catch (error) {
        console.error("Failed to get exam marking overrides:", error)
        return { success: false, error: String(error) }
      }
    }
  )
}
