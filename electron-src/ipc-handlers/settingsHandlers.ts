/**
 * 設定関連のIPCハンドラー
 */

import { ipcMain } from "electron"

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
  getScoringPreferenceColumn,
  getUserKeyboardShortcuts,
  getUserScoringPreference,
  resetUserKeyboardShortcuts,
  type ScoringPreferenceColumnName,
  type ScoringPreferenceColumns,
  type ScoringPreferenceData,
  setScoringPreferenceColumn,
  upsertUserScoringPreference,
} from "../lib/prisma/userSettings"

export function registerSettingsHandlers() {
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
  // UserScoringPreference
  // =========================================================================

  ipcMain.handle(
    "settings:getUserScoringPreference",
    async (_event, userId: string) => {
      try {
        const preference = await getUserScoringPreference(userId)
        return { success: true, preference }
      } catch (error) {
        console.error("Failed to get scoring preference:", error)
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    "settings:upsertUserScoringPreference",
    async (_event, userId: string, data: ScoringPreferenceData) => {
      try {
        const preference = await upsertUserScoringPreference(userId, data)
        return { success: true, preference }
      } catch (error) {
        console.error("Failed to upsert scoring preference:", error)
        return { success: false, error: String(error) }
      }
    }
  )

  // カラム別取得
  ipcMain.handle(
    "settings:getScoringPreferenceColumn",
    async (
      _event,
      userId: string,
      column: ScoringPreferenceColumnName
    ): Promise<{
      success: boolean
      value?: ScoringPreferenceColumns[typeof column]
      error?: string
    }> => {
      try {
        const value = await getScoringPreferenceColumn(userId, column)
        return { success: true, value }
      } catch (error) {
        console.error(
          `Failed to get scoring preference column [${column}]:`,
          error
        )
        return { success: false, error: String(error) }
      }
    }
  )

  // カラム別設定（楽観的更新用）
  ipcMain.handle(
    "settings:setScoringPreferenceColumn",
    async (
      _event,
      userId: string,
      column: ScoringPreferenceColumnName,
      value: ScoringPreferenceColumns[typeof column]
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        await setScoringPreferenceColumn(userId, column, value)
        return { success: true }
      } catch (error) {
        console.error(
          `Failed to set scoring preference column [${column}]:`,
          error
        )
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
