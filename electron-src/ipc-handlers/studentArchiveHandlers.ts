/**
 * 生徒アーカイブ（エクスポート/インポート）IPCハンドラー
 */

import { dialog, ipcMain } from "electron"

import type { UpdateDecisions } from "../../src/types/examArchive.types"
import type {
  ExportStudentsArchiveOptions,
  StudentArchiveFileOverviewData,
  StudentArchiveIdIntegrationConfig,
} from "../../src/types/studentArchive.types"
import { exportStudentsArchive } from "../lib/export/student-archive"
import {
  cleanupStudentTempDir,
  executeStudentImport,
  extractStudentArchive,
  performStudentPreMatching,
} from "../lib/import/student-archive"

/**
 * 生徒アーカイブ関連のIPCハンドラーを登録
 */
export function registerStudentArchiveHandlers(): void {
  // エクスポート
  ipcMain.handle(
    "studentArchive:exportStudents",
    async (_event, options: ExportStudentsArchiveOptions) => {
      try {
        return await exportStudentsArchive(options)
      } catch (error) {
        console.error("Error in studentArchive:exportStudents:", error)
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

  // インポートファイル選択ダイアログ
  ipcMain.handle("studentArchive:selectImportFile", async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: "生徒データをインポート",
        filters: [
          { name: "生徒データ (.students)", extensions: ["students"] },
          { name: "すべてのファイル", extensions: ["*"] },
        ],
        properties: ["openFile"],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, canceled: true }
      }

      return { success: true, filePath: result.filePaths[0] }
    } catch (error) {
      console.error("Error in studentArchive:selectImportFile:", error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "ダイアログ表示に失敗しました",
      }
    }
  })

  // アーカイブ解析（マニフェスト読み取り）
  ipcMain.handle(
    "studentArchive:analyzeArchive",
    async (_event, options: { archivePath: string }) => {
      let tempDir: string | null = null
      try {
        const extractResult = await extractStudentArchive(options.archivePath)
        if (!extractResult.success || !extractResult.data) {
          return { success: false, error: extractResult.error }
        }
        tempDir = extractResult.data.tempDir
        return { success: true, manifest: extractResult.data.manifest }
      } catch (error) {
        console.error("Error in studentArchive:analyzeArchive:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "アーカイブ解析に失敗しました",
        }
      } finally {
        if (tempDir) cleanupStudentTempDir(tempDir)
      }
    }
  )

  // 事前照合
  ipcMain.handle(
    "studentArchive:preMatch",
    async (_event, options: { archivePath: string }) => {
      let tempDir: string | null = null
      try {
        const extractResult = await extractStudentArchive(options.archivePath)
        if (!extractResult.success || !extractResult.data) {
          return { success: false, error: extractResult.error }
        }
        tempDir = extractResult.data.tempDir

        const fileOverviewData = await performStudentPreMatching(
          extractResult.data
        )

        return { success: true, data: fileOverviewData }
      } catch (error) {
        console.error("Error in studentArchive:preMatch:", error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "事前照合に失敗しました",
        }
      } finally {
        if (tempDir) cleanupStudentTempDir(tempDir)
      }
    }
  )

  // インポート実行
  ipcMain.handle(
    "studentArchive:import",
    async (
      _event,
      options: {
        archivePath: string
        preMatchResult: StudentArchiveFileOverviewData
        integrationConfig: StudentArchiveIdIntegrationConfig
        updateDecisions?: UpdateDecisions
      }
    ) => {
      let tempDir: string | null = null
      try {
        const extractResult = await extractStudentArchive(options.archivePath)
        if (!extractResult.success || !extractResult.data) {
          return { success: false, error: extractResult.error }
        }
        tempDir = extractResult.data.tempDir

        const result = await executeStudentImport(
          extractResult.data,
          options.preMatchResult,
          options.integrationConfig,
          options.updateDecisions
        )

        return result
      } catch (error) {
        console.error("Error in studentArchive:import:", error)
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "インポートに失敗しました",
        }
      } finally {
        if (tempDir) cleanupStudentTempDir(tempDir)
      }
    }
  )
}
