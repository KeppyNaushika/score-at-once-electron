/**
 * 試験アーカイブ（エクスポート/インポート）IPCハンドラー
 */

import { dialog, ipcMain } from "electron"
import * as path from "path"

import type {
  BulkExportExamResult,
  BulkExportExamsResult,
  ExportMode,
  FileOverviewData,
  IdIntegrationConfig,
  MatchingConfig,
  ScoringConflictConfig,
  UpdateDecisions,
} from "../../types/examArchive.types"
import { exportExam } from "../lib/export/exam-archive"
import { generateExportFileName } from "../lib/export/exam-archive/archiveCreator"
import {
  analyzeArchive,
  cleanupTempDir,
  extractArchive,
} from "../lib/import/exam-archive"
import { convertHszToScore } from "../lib/import/external-formats/hsz"
import { convertDatToScore } from "../lib/import/external-formats/reattendant"
import {
  detectAllConflicts,
  detectScoringConflictsWithUserDecisions,
  executeIdIntegrationImport,
  performPreMatching,
} from "../lib/import/merge"
import { getExamById } from "../lib/prisma/exam"

/**
 * 一括エクスポートのコアロジック
 *
 * ダイアログを含まず、指定されたディレクトリに順次エクスポートする
 */
export async function executeBulkExport(
  examIds: string[],
  userId: string,
  outputDirectory: string,
  exportMode?: ExportMode
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
    success: results.some((r) => r.success),
    results,
    outputDirectory,
  }
}

/**
 * アーカイブ関連のIPCハンドラーを登録
 */
export function registerArchiveHandlers(): void {
  // エクスポート
  ipcMain.handle(
    "archive:exportExam",
    async (
      _event,
      options: {
        examId: string
        userId: string
        outputPath?: string
        exportMode?: import("../../types/examArchive.types").ExportMode
      }
    ) => {
      try {
        return await exportExam(options)
      } catch (error) {
        console.error("Error in archive:exportExam:", error)
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
  ipcMain.handle("archive:selectImportFile", async () => {
    try {
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
          const AdmZip = (await import("adm-zip")).default
          const zip = new AdmZip(filePath)
          const hasVersion = zip
            .getEntries()
            .some((e) => e.entryName.endsWith("RealtendantAppVersion.txt"))
          if (hasVersion) {
            sourceFormat = "dat"
          }
        } catch {
          // ZIPとして開けない場合は.score扱い（後段でエラーになる）
        }
      }

      return { success: true, filePath, sourceFormat }
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

  // .hsz → .score 変換
  ipcMain.handle(
    "archive:convertHszToScore",
    async (_event, options: { hszPath: string }) => {
      try {
        return await convertHszToScore(options.hszPath)
      } catch (error) {
        console.error("Error in archive:convertHszToScore:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : ".hsz ファイルの変換に失敗しました",
        }
      }
    }
  )

  // .dat → .score 変換
  ipcMain.handle(
    "archive:convertDatToScore",
    async (_event, options: { datPath: string }) => {
      try {
        return await convertDatToScore(options.datPath)
      } catch (error) {
        console.error("Error in archive:convertDatToScore:", error)
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : ".dat ファイルの変換に失敗しました",
        }
      }
    }
  )

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

  // 一括エクスポート
  ipcMain.handle(
    "archive:bulkExportExams",
    async (
      _event,
      options: {
        examIds: string[]
        userId: string
        exportMode?: ExportMode
      }
    ): Promise<BulkExportExamsResult> => {
      try {
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
      } catch (error) {
        console.error("Error in archive:bulkExportExams:", error)
        return {
          success: false,
          results: [],
          error:
            error instanceof Error
              ? error.message
              : "一括エクスポートに失敗しました",
        }
      }
    }
  )
}
