/**
 * 試験アーカイブ（エクスポート/インポート）IPCハンドラー
 */

import AdmZip from "adm-zip"
import { dialog, ipcMain } from "electron"
import * as path from "path"

import type {
  ArchiveExportMode,
  BulkExportExamResult,
  BulkExportExamsResult,
  FileOverviewData,
  IdIntegrationConfig,
  ScoringConflictConfig,
  UpdateDecisions,
} from "../../src/types/examArchive.types"
import { exportExam } from "../lib/export/exam-archive"
import { generateExportFileName } from "../lib/export/exam-archive/archiveCreator"
import { analyzeArchive } from "../lib/import/exam-archive"
import {
  cleanupTempDir,
  extractArchive,
} from "../lib/import/exam-archive/archiveExtractor"
import { convertHszToScore } from "../lib/import/external-formats/hsz/hszConverter"
import { convertDatToScore } from "../lib/import/external-formats/reattendant/datConverter"
import { executeIdIntegrationImport } from "../lib/import/merge/idIntegrationImporter"
import { performPreMatching } from "../lib/import/merge/matcher"
import { detectScoringConflictsWithUserDecisions } from "../lib/import/merge/scoringConflictDetector"
import { getExamById } from "../lib/prisma/exam"
import { registerSafeHandler } from "./ipcHandlerUtils"

/**
 * 一括エクスポートのコアロジック
 *
 * ダイアログを含まず、指定されたディレクトリに順次エクスポートする
 */
export async function executeBulkExport(
  examIds: string[],
  userId: string,
  outputDirectory: string,
  exportMode?: ArchiveExportMode
): Promise<BulkExportExamsResult> {
  const results: BulkExportExamResult[] = []

  // 順次処理（SQLite同時書き込み制限のため）
  for (const examId of examIds) {
    try {
      const exam = await getExamById(examId)
      if (!exam) {
        results.push({
          examId,
          examName: examId,
          success: false,
          error: "試験が見つかりません",
        })
        continue
      }

      const fileName = generateExportFileName(exam.examName, exportMode)
      const outputPath = path.join(outputDirectory, fileName)

      const exportResult = await exportExam({
        examId,
        userId,
        outputPath,
        exportMode,
      })

      results.push({
        examId,
        examName: exam.examName,
        success: exportResult.success,
        outputPath: exportResult.outputPath,
        error: exportResult.error,
      })
    } catch (error) {
      results.push({
        examId,
        examName: examId,
        success: false,
        error:
          error instanceof Error ? error.message : "エクスポートに失敗しました",
      })
    }
  }

  return {
    success: results.some((result) => result.success),
    results,
    outputDirectory,
  }
}

/**
 * アーカイブ関連のIPCハンドラーを登録
 */
export function registerArchiveHandlers(): void {
  // エクスポート
  registerSafeHandler(
    "archive:exportExam",
    async (options: {
      examId: string
      userId: string
      outputPath?: string
      exportMode?: ArchiveExportMode
    }) => {
      return await exportExam(options)
    },
    "エクスポートに失敗しました"
  )

  // インポートファイル選択ダイアログ
  registerSafeHandler(
    "archive:selectImportFile",
    async () => {
      const result = await dialog.showOpenDialog({
        title: "試験をインポート",
        filters: [
          {
            name: "対応ファイル (.score, .hsz, .dat)",
            extensions: ["score", "hsz", "dat"],
          },
          {
            name: "一括採点試験データ (.score)",
            extensions: ["score"],
          },
          {
            name: "百問繚乱™データ（採点情報のみ）(.hsz)",
            extensions: ["hsz"],
          },
          {
            name: "リアテンダント™データ（採点情報のみ）(.dat)",
            extensions: ["dat"],
          },
          { name: "すべてのファイル", extensions: ["*"] },
        ],
        properties: ["openFile"],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, canceled: true }
      }

      const filePath = result.filePaths[0]
      const ext = path.extname(filePath).toLowerCase()

      // .datファイルはリアテンダント形式かどうかをZIP内のファイルで判定
      let sourceFormat: "score" | "hsz" | "dat" =
        ext === ".hsz" ? "hsz" : "score"

      if (ext === ".dat") {
        try {
          const zip = new AdmZip(filePath)
          const hasVersion = zip
            .getEntries()
            .some((entry) =>
              entry.entryName.endsWith("RealtendantAppVersion.txt")
            )
          if (hasVersion) {
            sourceFormat = "dat"
          }
        } catch {
          // ZIPとして開けない場合は.score扱い（後段でエラーになる）
        }
      }

      return { success: true, filePath, sourceFormat }
    },
    "ダイアログ表示に失敗しました"
  )

  // .hsz → .score 変換
  registerSafeHandler(
    "archive:convertHszToScore",
    async (options: { hszPath: string }) => {
      return await convertHszToScore(options.hszPath)
    },
    ".hsz ファイルの変換に失敗しました"
  )

  // .dat → .score 変換
  registerSafeHandler(
    "archive:convertDatToScore",
    async (options: { datPath: string }) => {
      return await convertDatToScore(options.datPath)
    },
    ".dat ファイルの変換に失敗しました"
  )

  // アーカイブ解析（プレビュー用）
  registerSafeHandler(
    "archive:analyzeArchive",
    async (options: { archivePath: string }) => {
      return await analyzeArchive(options)
    },
    "アーカイブ解析に失敗しました"
  )

  // 事前照合（Step 2: ファイル概要表示用）
  // NOTE: Uses finally block for tempDir cleanup, kept as manual ipcMain.handle
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
        console.error("Error in IPC handler [archive:preMatch]:", error)
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

  // 採点競合検出（ユーザーの判断に基づく）
  // NOTE: Uses finally block for tempDir cleanup, kept as manual ipcMain.handle
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
        console.error(
          "Error in IPC handler [archive:detectScoringConflicts]:",
          error
        )
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
  // NOTE: Uses finally block for tempDir cleanup, kept as manual ipcMain.handle
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
        updateDecisions?: UpdateDecisions
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
          options.scoringConflictConfig,
          options.updateDecisions
        )

        return result
      } catch (error) {
        console.error(
          "Error in IPC handler [archive:idIntegrationImport]:",
          error
        )
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

  // 一括エクスポート
  registerSafeHandler(
    "archive:bulkExportExams",
    async (options: {
      examIds: string[]
      userId: string
      exportMode?: ArchiveExportMode
    }): Promise<BulkExportExamsResult> => {
      // フォルダ選択ダイアログを表示
      const dialogResult = await dialog.showOpenDialog({
        title: "一括書き出し先フォルダを選択",
        properties: ["openDirectory", "createDirectory"],
      })

      if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
        return { success: false, results: [], error: "canceled" }
      }

      return await executeBulkExport(
        options.examIds,
        options.userId,
        dialogResult.filePaths[0],
        options.exportMode
      )
    },
    "一括エクスポートに失敗しました"
  )
}
