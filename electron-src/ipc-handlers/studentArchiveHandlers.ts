/**
 * 生徒アーカイブ（.students）の取り込み IPC ハンドラー
 *
 * 旧形式は読み込みだけ残して凍結した（書き出しは統合アーカイブ .sao に一本化）。
 */

import { dialog } from "electron"

import type { ImportAction } from "../../src/types/importAction.types"
import type {
  StudentArchiveFileOverviewData,
  StudentArchiveIdIntegrationConfig,
} from "../../src/types/studentArchive.types"
import {
  cleanupStudentTempDir,
  executeStudentImport,
  extractStudentArchive,
  performStudentPreMatching,
} from "../lib/import/student-archive"
import { type HandlerMap } from "./ipcHandlerUtils"

/**
 * 生徒アーカイブ関連のIPCハンドラーを登録
 */
export const studentArchiveHandlers = {
  // 取り込みウィザードの中でファイルを選び直す（最初のファイルは一覧の「読み込み」で選ぶ）
  "studentArchive:selectImportFile": async () => {
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
  },

  // アーカイブ解析（マニフェスト読み取り）
  "studentArchive:analyzeArchive": async (options: { archivePath: string }) => {
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
  },

  // 事前照合
  "studentArchive:preMatch": async (options: { archivePath: string }) => {
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
  },

  // インポート実行
  "studentArchive:import": async (options: {
    archivePath: string
    preMatchResult: StudentArchiveFileOverviewData
    integrationConfig: StudentArchiveIdIntegrationConfig
    /** 取り込みの方針（上書きする / 統合する / 別で追加する）。省略時は統合 */
    action?: ImportAction
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
        options.action
      )

      return result
    } finally {
      if (tempDir) cleanupStudentTempDir(tempDir)
    }
  },
} satisfies HandlerMap
