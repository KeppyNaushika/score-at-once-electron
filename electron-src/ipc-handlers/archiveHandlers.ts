/**
 * プロジェクトアーカイブ（エクスポート/インポート）IPCハンドラー
 */

import { dialog, ipcMain } from "electron"

import type {
  ConflictResolutions,
  FileOverviewData,
  IdIntegrationConfig,
  MatchingConfig,
  ScoringConflictConfig,
} from "../../types/projectArchive.types"
import {
  exportProject,
  selectExportSavePath,
} from "../lib/export/project-archive"
import {
  detectAllConflicts,
  detectScoringConflictsWithUserDecisions,
  executeIdIntegrationImport,
  executeMergeImport,
  performPreMatching,
} from "../lib/import/merge"
import {
  analyzeArchive,
  cleanupTempDir,
  extractArchive,
  importAsNew,
} from "../lib/import/project-archive"

/**
 * アーカイブ関連のIPCハンドラーを登録
 */
export function registerArchiveHandlers(): void {
  // エクスポート
  ipcMain.handle(
    "archive:exportProject",
    async (
      _event,
      options: { projectId: string; userId: string; outputPath?: string }
    ) => {
      try {
        return await exportProject(options)
      } catch (error) {
        console.error("Error in archive:exportProject:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "エクスポートに失敗しました",
        }
      }
    }
  )

  // エクスポート保存先選択ダイアログ
  ipcMain.handle(
    "archive:selectExportSavePath",
    async (_event, options: { projectName?: string }) => {
      try {
        return await selectExportSavePath(options)
      } catch (error) {
        console.error("Error in archive:selectExportSavePath:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "ダイアログ表示に失敗しました",
        }
      }
    }
  )

  // インポートファイル選択ダイアログ
  ipcMain.handle("archive:selectImportFile", async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: "プロジェクトをインポート",
        filters: [
          { name: "一括採点プロジェクトデータ", extensions: ["score"] },
        ],
        properties: ["openFile"],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, canceled: true }
      }

      return { success: true, filePath: result.filePaths[0] }
    } catch (error) {
      console.error("Error in archive:selectImportFile:", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "ダイアログ表示に失敗しました",
      }
    }
  })

  // アーカイブ解析（プレビュー用）
  ipcMain.handle(
    "archive:analyzeArchive",
    async (_event, options: { archivePath: string }) => {
      try {
        return await analyzeArchive(options)
      } catch (error) {
        console.error("Error in archive:analyzeArchive:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "アーカイブ解析に失敗しました",
        }
      }
    }
  )

  // 新規作成インポート
  ipcMain.handle(
    "archive:importAsNew",
    async (_event, options: { archivePath: string; currentUserId: string }) => {
      try {
        return await importAsNew(options)
      } catch (error) {
        console.error("Error in archive:importAsNew:", error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "インポートに失敗しました",
        }
      }
    }
  )

  // 事前照合（Step 2: ファイル概要表示用）
  ipcMain.handle(
    "archive:preMatch",
    async (_event, options: { archivePath: string }) => {
      let tempDir: string | null = null

      try {
        // アーカイブを展開
        const extractResult = await extractArchive(options.archivePath)
        if (!extractResult.success || !extractResult.data) {
          return { success: false, error: extractResult.error }
        }
        tempDir = extractResult.data.tempDir

        // 事前照合を実行
        const fileOverviewData = await performPreMatching(extractResult.data)

        return { success: true, data: fileOverviewData }
      } catch (error) {
        console.error("Error in archive:preMatch:", error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "事前照合に失敗しました",
        }
      } finally {
        if (tempDir) {
          cleanupTempDir(tempDir)
        }
      }
    }
  )

  // 競合検出
  ipcMain.handle(
    "archive:detectConflicts",
    async (
      _event,
      options: { archivePath: string; matchingConfig: MatchingConfig }
    ) => {
      let tempDir: string | null = null

      try {
        // アーカイブを展開
        const extractResult = await extractArchive(options.archivePath)
        if (!extractResult.success || !extractResult.data) {
          return { success: false, error: extractResult.error }
        }
        tempDir = extractResult.data.tempDir

        // 競合検出
        const result = await detectAllConflicts(
          extractResult.data,
          options.matchingConfig
        )

        return result
      } catch (error) {
        console.error("Error in archive:detectConflicts:", error)
        return {
          success: false,
          results: [],
          error:
            error instanceof Error ? error.message : "競合検出に失敗しました",
        }
      } finally {
        if (tempDir) {
          cleanupTempDir(tempDir)
        }
      }
    }
  )

  // マージインポート
  ipcMain.handle(
    "archive:mergeImport",
    async (
      _event,
      options: {
        archivePath: string
        matchingConfig: MatchingConfig
        conflictResolutions: ConflictResolutions
        currentUserId: string
      }
    ) => {
      let tempDir: string | null = null

      try {
        // アーカイブを展開
        const extractResult = await extractArchive(options.archivePath)
        if (!extractResult.success || !extractResult.data) {
          return { success: false, error: extractResult.error }
        }
        tempDir = extractResult.data.tempDir

        // マージインポートを実行
        const result = await executeMergeImport(
          extractResult.data,
          options.matchingConfig,
          options.conflictResolutions,
          options.currentUserId
        )

        return result
      } catch (error) {
        console.error("Error in archive:mergeImport:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "マージインポートに失敗しました",
        }
      } finally {
        if (tempDir) {
          cleanupTempDir(tempDir)
        }
      }
    }
  )

  // 採点競合検出（ユーザーの判断に基づく）
  ipcMain.handle(
    "archive:detectScoringConflicts",
    async (
      _event,
      options: {
        archivePath: string
        preMatchResult: FileOverviewData
        integrationConfig: IdIntegrationConfig
      }
    ) => {
      let tempDir: string | null = null

      try {
        // アーカイブを展開
        const extractResult = await extractArchive(options.archivePath)
        if (!extractResult.success || !extractResult.data) {
          return { success: false, error: extractResult.error }
        }
        tempDir = extractResult.data.tempDir

        // 採点競合を検出
        const scoringConflicts = await detectScoringConflictsWithUserDecisions(
          extractResult.data,
          options.preMatchResult,
          options.integrationConfig
        )

        return { success: true, data: scoringConflicts }
      } catch (error) {
        console.error("Error in archive:detectScoringConflicts:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "採点競合の検出に失敗しました",
        }
      } finally {
        if (tempDir) {
          cleanupTempDir(tempDir)
        }
      }
    }
  )

  // ID統合インポート（新しいフロー）
  ipcMain.handle(
    "archive:idIntegrationImport",
    async (
      _event,
      options: {
        archivePath: string
        preMatchResult: FileOverviewData
        integrationConfig: IdIntegrationConfig
        currentUserId: string
        scoringConflictConfig?: ScoringConflictConfig
      }
    ) => {
      let tempDir: string | null = null

      try {
        // アーカイブを展開
        const extractResult = await extractArchive(options.archivePath)
        if (!extractResult.success || !extractResult.data) {
          return { success: false, error: extractResult.error }
        }
        tempDir = extractResult.data.tempDir

        // ID統合インポートを実行
        const result = await executeIdIntegrationImport(
          extractResult.data,
          options.preMatchResult,
          options.integrationConfig,
          options.currentUserId,
          options.scoringConflictConfig
        )

        return result
      } catch (error) {
        console.error("Error in archive:idIntegrationImport:", error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "インポートに失敗しました",
        }
      } finally {
        if (tempDir) {
          cleanupTempDir(tempDir)
        }
      }
    }
  )
}
