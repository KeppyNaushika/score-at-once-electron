/**
 * 生徒アーカイブ（エクスポート/インポート）IPCハンドラー
 */

import { dialog } from "electron"

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
import { registerHandler } from "./ipcHandlerUtils"

/**
 * 生徒アーカイブ関連のIPCハンドラーを登録
 */
export function registerStudentArchiveHandlers(): void {
  // エクスポート
  registerHandler(
    "studentArchive:exportStudents",
    async (options: ExportStudentsArchiveOptions) => {
      return await exportStudentsArchive(options)
    }
  )

  // インポートファイル選択ダイアログ
  registerHandler("studentArchive:selectImportFile", async () => {
    const result = await dialog.showOpenDialog({
      title: "生徒データをインポート",
      filters: [
        { name: "生徒データ (.students)", extensions: ["students"] },
        { name: "すべてのファイル", extensions: ["*"] },
      ],
      properties: ["openFile"],
    })

    // 選ばずに閉じたのは失敗ではない
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true as const }
    }

    return { canceled: false as const, filePath: result.filePaths[0] }
  })

  // アーカイブ解析（マニフェスト読み取り）
  registerHandler(
    "studentArchive:analyzeArchive",
    async (options: { archivePath: string }) => {
      let tempDir: string | null = null
      try {
        const extractResult = await extractStudentArchive(options.archivePath)
        if (!extractResult.success || !extractResult.data) {
          throw new Error(extractResult.error ?? "アーカイブを展開できません")
        }
        tempDir = extractResult.data.tempDir
        return extractResult.data.manifest
      } finally {
        if (tempDir) cleanupStudentTempDir(tempDir)
      }
    }
  )

  // 事前照合
  registerHandler(
    "studentArchive:preMatch",
    async (options: { archivePath: string }) => {
      let tempDir: string | null = null
      try {
        const extractResult = await extractStudentArchive(options.archivePath)
        if (!extractResult.success || !extractResult.data) {
          throw new Error(extractResult.error ?? "アーカイブを展開できません")
        }
        tempDir = extractResult.data.tempDir

        const fileOverviewData = await performStudentPreMatching(
          extractResult.data
        )

        return fileOverviewData
      } finally {
        if (tempDir) cleanupStudentTempDir(tempDir)
      }
    }
  )

  // インポート実行
  registerHandler(
    "studentArchive:import",
    async (options: {
      archivePath: string
      preMatchResult: StudentArchiveFileOverviewData
      integrationConfig: StudentArchiveIdIntegrationConfig
      updateDecisions?: UpdateDecisions
    }) => {
      let tempDir: string | null = null
      try {
        const extractResult = await extractStudentArchive(options.archivePath)
        if (!extractResult.success || !extractResult.data) {
          throw new Error(extractResult.error ?? "アーカイブを展開できません")
        }
        tempDir = extractResult.data.tempDir

        const result = await executeStudentImport(
          extractResult.data,
          options.preMatchResult,
          options.integrationConfig,
          options.updateDecisions
        )

        return result
      } finally {
        if (tempDir) cleanupStudentTempDir(tempDir)
      }
    }
  )
}
