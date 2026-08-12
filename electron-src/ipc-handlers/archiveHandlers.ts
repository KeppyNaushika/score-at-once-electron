/**
 * 試験アーカイブ（エクスポート/インポート）IPCハンドラー
 */

import AdmZip from "adm-zip"
import { dialog } from "electron"
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
import { exportExam, exportExamTo } from "../lib/export/exam-archive"
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
import { type HandlerMap } from "./ipcHandlerUtils"

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
): Promise<{ results: BulkExportExamResult[]; outputDirectory: string }> {
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

      const exportResult = await exportExamTo({
        examId,
        userId,
        outputPath,
        exportMode,
      })

      results.push({
        examId,
        examName: exam.examName,
        success: true,
        outputPath: exportResult.outputPath,
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

  return { results, outputDirectory }
}

/**
 * アーカイブ関連のIPCハンドラーを登録
 */
export const archiveHandlers = {
  // エクスポート
  "archive:exportExam": async (options: {
    examId: string
    userId: string
    exportMode?: ArchiveExportMode
  }) => {
    return await exportExam(options)
  },

  // インポートファイル選択ダイアログ
  "archive:selectImportFile": async () => {
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

    // 選ばずに閉じたのは失敗ではない
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true as const }
    }

    const filePath = result.filePaths[0]
    const ext = path.extname(filePath).toLowerCase()

    // .datファイルはリアテンダント形式かどうかをZIP内のファイルで判定
    let sourceFormat: "score" | "hsz" | "dat" = ext === ".hsz" ? "hsz" : "score"

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

    return { canceled: false as const, filePath, sourceFormat }
  },

  // .hsz → .score 変換
  "archive:convertHszToScore": async (options: { hszPath: string }) => {
    return await convertHszToScore(options.hszPath)
  },

  // .dat → .score 変換
  "archive:convertDatToScore": async (options: { datPath: string }) => {
    return await convertDatToScore(options.datPath)
  },

  // アーカイブ解析（プレビュー用）
  "archive:analyzeArchive": async (options: { archivePath: string }) => {
    return await analyzeArchive(options)
  },

  // 事前照合（Step 2: ファイル概要表示用）
  "archive:preMatch": async (options: { archivePath: string }) => {
    let tempDir: string | null = null

    try {
      // アーカイブを展開
      const extractResult = await extractArchive(options.archivePath)
      if (!extractResult.success || !extractResult.data) {
        throw new Error(extractResult.error ?? "アーカイブを展開できません")
      }
      tempDir = extractResult.data.tempDir

      return await performPreMatching(extractResult.data)
    } finally {
      if (tempDir) {
        cleanupTempDir(tempDir)
      }
    }
  },

  // 採点競合検出（ユーザーの判断に基づく）
  "archive:detectScoringConflicts": async (options: {
    archivePath: string
    preMatchResult: FileOverviewData
    integrationConfig: IdIntegrationConfig
  }) => {
    let tempDir: string | null = null

    try {
      // アーカイブを展開
      const extractResult = await extractArchive(options.archivePath)
      if (!extractResult.success || !extractResult.data) {
        throw new Error(extractResult.error ?? "アーカイブを展開できません")
      }
      tempDir = extractResult.data.tempDir

      // 採点競合を検出
      return await detectScoringConflictsWithUserDecisions(
        extractResult.data,
        options.preMatchResult,
        options.integrationConfig
      )
    } finally {
      if (tempDir) {
        cleanupTempDir(tempDir)
      }
    }
  },

  // ID統合インポート（新しいフロー）
  "archive:idIntegrationImport": async (options: {
    archivePath: string
    preMatchResult: FileOverviewData
    integrationConfig: IdIntegrationConfig
    currentUserId: string
    scoringConflictConfig?: ScoringConflictConfig
    updateDecisions?: UpdateDecisions
  }) => {
    let tempDir: string | null = null

    try {
      // アーカイブを展開
      const extractResult = await extractArchive(options.archivePath)
      if (!extractResult.success || !extractResult.data) {
        throw new Error(extractResult.error ?? "アーカイブを展開できません")
      }
      tempDir = extractResult.data.tempDir

      // ID統合インポートを実行
      return await executeIdIntegrationImport(
        extractResult.data,
        options.preMatchResult,
        options.integrationConfig,
        options.currentUserId,
        options.scoringConflictConfig,
        options.updateDecisions
      )
    } finally {
      if (tempDir) {
        cleanupTempDir(tempDir)
      }
    }
  },

  // 一括エクスポート
  "archive:bulkExportExams": async (options: {
    examIds: string[]
    userId: string
    exportMode?: ArchiveExportMode
  }): Promise<BulkExportExamsResult> => {
    // フォルダ選択ダイアログを表示
    const dialogResult = await dialog.showOpenDialog({
      title: "一括書き出し先フォルダを選択",
      properties: ["openDirectory", "createDirectory"],
    })

    // 出力先を選ばずに閉じたのは失敗ではない
    if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
      return { canceled: true as const }
    }

    return {
      canceled: false as const,
      ...(await executeBulkExport(
        options.examIds,
        options.userId,
        dialogResult.filePaths[0],
        options.exportMode
      )),
    }
  },
} satisfies HandlerMap
