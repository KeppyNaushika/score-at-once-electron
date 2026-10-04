/**
 * 試験アーカイブ（.score）の取り込み IPC ハンドラー
 *
 * 旧形式は読み込みだけ残して凍結した（書き出しは統合アーカイブ .sao に一本化）。
 */

import { dialog } from "electron"

import type {
  FileOverviewData,
  IdIntegrationConfig,
} from "../../src/types/examArchive.types"
import { archiveImportFileKindOf } from "../lib/import/archiveImportFileKind"
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
import { type HandlerMap } from "./ipcHandlerUtils"

/**
 * アーカイブ関連のIPCハンドラーを登録
 */
export const archiveHandlers = {
  // 取り込みウィザードの中でファイルを選び直す（最初のファイルは一覧の「読み込み」で選ぶ）
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
    // .dat はリアテンダント™の形式でなければ .score 扱い（後段でエラーになる）
    const kind = archiveImportFileKindOf(filePath)
    const sourceFormat: "score" | "hsz" | "dat" =
      kind === "hsz" || kind === "dat" ? kind : "score"

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
        options.currentUserId
      )
    } finally {
      if (tempDir) {
        cleanupTempDir(tempDir)
      }
    }
  },
} satisfies HandlerMap
