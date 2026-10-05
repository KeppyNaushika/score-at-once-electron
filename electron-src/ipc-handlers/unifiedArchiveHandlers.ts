/**
 * 統合アーカイブ（.sao）の書き出し・取り込みの IPC ハンドラー
 *
 * 設計は docs/unified-archive-design.md §6・§7。範囲・書き出し・開く・取り込むの規則は core
 * （`lib/export/unified-archive/`・`lib/import/unified-archive/`）にあり、ここは electron の
 * ダイアログ・DB とデータディレクトリの場所・進捗の押し出し・監査ログをつなぐだけ。
 *
 * 下見・開く・試し取り込みは失敗を `kind` で返す（ウィザードがモーダルの中に出す）。
 * 想定外の失敗だけを例外にする。
 *
 * 書き出しと下見は better-sqlite3 の同期処理が重いので、main では行わず作業者（utilityProcess）に
 * 頼む（`archiveExportWorkerClient.ts`）。.partial からの置き換えと監査ログは main に残す。
 */

import * as crypto from "crypto"
import { app, BrowserWindow, dialog, utilityProcess } from "electron"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import {
  ARCHIVE_IMPORT_FILE_KINDS,
  type SelectedArchiveImportFile,
} from "../../src/types/archiveImportFile.types"
import type { ImportAction } from "../../src/types/importAction.types"
import { UNIFIED_ARCHIVE_EXTENSION } from "../../src/types/unifiedArchive.types"
import { getSharedFilesDirectory } from "../lib/dataManager"
import type { ArchiveExportWorkerResponse } from "../lib/export/unified-archive/archiveExportJob"
import {
  type ArchiveExportWorkerProcess,
  createArchiveExportWorkerClient,
} from "../lib/export/unified-archive/archiveExportWorkerClient"
import type { ArchiveSelection } from "../lib/export/unified-archive/archiveScopeResolver"
import type {
  UnifiedArchiveExportPhase,
  UnifiedArchiveExportResult,
} from "../lib/export/unified-archive/unifiedArchiveCreator"
import { archiveImportFileKindOf } from "../lib/import/archiveImportFileKind"
import { importUnifiedArchiveFiles } from "../lib/import/unified-archive/archiveFileImporter"
import { collectArchiveGradeImpactSource } from "../lib/import/unified-archive/archiveGradeImpactSource"
import {
  closeUnifiedArchiveImportSession,
  getUnifiedArchiveImportSession,
  openUnifiedArchiveImportSession,
} from "../lib/import/unified-archive/archiveImportSessions"
import {
  findArchiveMatchCandidates,
  suggestedMatchDecisions,
} from "../lib/import/unified-archive/archiveMatchCandidates"
import {
  analyzeUnifiedArchiveImport,
  importUnifiedArchiveRows,
  prismaArchiveTarget,
  prismaArchiveTransaction,
  UnifiedArchiveUnresolvableConflictError,
} from "../lib/import/unified-archive/archiveRowImporter"
import type { UnifiedArchiveImportDecisions } from "../lib/import/unified-archive/types"
import { getCurrentActorUserId } from "../lib/prisma/auditActor"
import { recordAuditLog } from "../lib/prisma/auditLog"
import prisma from "../lib/prisma/client"
import { getDatabasePath } from "../lib/prisma/databaseInitializer"
import { getMigrationsDir } from "../lib/prisma/schema/migrationApplier"
import { type HandlerMap } from "./ipcHandlerUtils"

/** 試し取り込み・取り込みのトランザクションの時間切れ（Prisma の既定の5秒では足りない） */
const IMPORT_TRANSACTION_TIMEOUT_MS = 10 * 60_000

const ARCHIVE_FILE_FILTER = {
  name: "統合アーカイブ (.sao)",
  extensions: [UNIFIED_ARCHIVE_EXTENSION.slice(1)],
}

/**
 * 一覧の「読み込み」が受け付けるファイル。統合アーカイブと、読み込みだけ残した旧形式・
 * 外部の形式を全て受け付け、選ばれた拡張子で開く取り込み画面が決まる
 */
const ANY_IMPORT_FILE_FILTERS = [
  {
    name: "読み込めるファイル",
    extensions: [...ARCHIVE_IMPORT_FILE_KINDS],
  },
  ARCHIVE_FILE_FILTER,
  {
    name: "旧形式 (.score, .coursework, .grade, .asb, .students)",
    extensions: ["score", "coursework", "grade", "asb", "students"],
  },
  {
    name: "百問繚乱™・リアテンダント™データ（採点情報のみ）(.hsz, .dat)",
    extensions: ["hsz", "dat"],
  },
]

interface UnifiedArchiveImportInput {
  sessionId: string
  action: ImportAction
  decisions: UnifiedArchiveImportDecisions
}

const getAppVersion = (): string => {
  try {
    return app.getVersion()
  } catch {
    return "0.0.0"
  }
}

const requireMigrationsDir = (): string => {
  const migrationsDir = getMigrationsDir()
  if (!migrationsDir) {
    throw new Error("アプリに同梱の migration が見つかりません")
  }
  return migrationsDir
}

/**
 * 作業者の入り口。esbuild が main の束（main/electron-src/index.js）の隣に別の束として出す
 * （scripts/buildMain.js）。このファイルは main の束に入るので、`__dirname` はその置き場を指す。
 * パッケージでは app.asar の中にあり、utilityProcess は asar の中のスクリプトも起こせる
 */
const ARCHIVE_EXPORT_WORKER_PATH = path.join(
  __dirname,
  "unifiedArchiveExportWorker.js"
)

const spawnArchiveExportWorker = (): ArchiveExportWorkerProcess => {
  const child = utilityProcess.fork(ARCHIVE_EXPORT_WORKER_PATH, [], {
    serviceName: "統合アーカイブの書き出し",
    stdio: "inherit",
  })
  return {
    postMessage: (request) => child.postMessage(request),
    // 返事を送るのは同じビルドの作業者だけ（`ArchiveExportWorkerResponse` の形で送る）
    onMessage: (listener) =>
      child.on("message", (response: ArchiveExportWorkerResponse) =>
        listener(response)
      ),
    onExit: (listener) => child.on("exit", listener),
    kill: () => {
      child.kill()
    },
  }
}

const archiveExportWorker = createArchiveExportWorkerClient({
  spawn: spawnArchiveExportWorker,
})

/** 書き出しの作業者を終わらせ、終わっていない書き出し・下見を失敗にする（アプリの終了時） */
export function stopUnifiedArchiveExportWorker(): void {
  archiveExportWorker.shutdown()
}

/** 書き出しの進捗を開いている全部の窓へ送る。閉じかけの窓に送って失敗しても無視する */
const broadcastExportProgress = (phase: UnifiedArchiveExportPhase): void => {
  for (const browserWindow of BrowserWindow.getAllWindows()) {
    try {
      browserWindow.webContents.send("unifiedArchive:export-progress", phase)
    } catch {
      // ウィンドウが既に閉じられている場合は無視
    }
  }
}

/** 表名 → id の一覧を、表名 → 件数にする（空の表は載せない） */
const countIdLists = (
  idsByTable: Readonly<Record<string, readonly string[] | undefined>>
): Record<string, number> =>
  Object.fromEntries(
    Object.entries(idsByTable).flatMap(([table, ids]) =>
      ids && ids.length > 0 ? [[table, ids.length]] : []
    )
  )

export const unifiedArchiveHandlers = {
  /** 選択から、書き出す範囲の件数・実体の id・外せない理由・欠けたファイルを返す（DB は書かない） */
  "unifiedArchive:previewExport": async (selection: ArchiveSelection) =>
    archiveExportWorker.previewExport({
      sourceDatabasePath: getDatabasePath(),
      dataDirectory: getSharedFilesDirectory(),
      selection,
    }),

  /** 書き出し先を尋ねる。選ばずに閉じたら null */
  "unifiedArchive:selectExportPath": async (defaultFileName: string) => {
    const result = await dialog.showSaveDialog({
      title: "統合アーカイブを書き出す",
      defaultPath: defaultFileName,
      filters: [ARCHIVE_FILE_FILTER],
    })
    if (result.canceled || !result.filePath) return null
    return result.filePath
  },

  /**
   * 書き出す。同じ場所の一時ファイルへ書いてから置き換えるので、書きかけのファイルが残らず、
   * 保存ダイアログで上書きを選んだ既存のファイルは書き終えてから置き換わる。
   * 作業者の作業ディレクトリも main が用意して消すので、作業者が途中で終わっても残らない
   */
  "unifiedArchive:export": async (input: {
    selection: ArchiveSelection
    outputPath: string
  }) => {
    const partialPath = `${input.outputPath}.${crypto.randomUUID()}.partial`
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "sao-export-job-")
    )
    let exported: UnifiedArchiveExportResult
    try {
      exported = await archiveExportWorker.exportArchive(
        {
          sourceDatabasePath: getDatabasePath(),
          dataDirectory: getSharedFilesDirectory(),
          outputPath: partialPath,
          selection: input.selection,
          exportedByUserId: getCurrentActorUserId(),
          appVersion: getAppVersion(),
          temporaryDirectory,
        },
        broadcastExportProgress
      )
      fs.renameSync(partialPath, input.outputPath)
    } finally {
      fs.rmSync(partialPath, { force: true })
      fs.rmSync(temporaryDirectory, { recursive: true, force: true })
    }
    const { manifest } = exported

    await recordAuditLog({
      action: "archive.unified.export",
      entityType: "UnifiedArchive",
      entityId: path.basename(input.outputPath),
      target: path.basename(input.outputPath),
      extra: {
        outputPath: input.outputPath,
        roots: countIdLists(manifest.selection.roots),
        shared: countIdLists(manifest.selection.shared),
        scoring: manifest.selection.scoring.kind,
        includeAnswers: manifest.selection.includeAnswers,
        optionalItems: manifest.selection.optionalItems,
        excludedRowCounts: manifest.exclusions.excludedRowCounts,
        missingFileCount: manifest.files.missing.length,
      },
    })

    return { outputPath: input.outputPath, manifest }
  },

  /**
   * 一覧の「読み込み」のファイル選択。統合アーカイブも旧形式も受け付け、拡張子から種類を
   * 決めて返す（どの取り込み画面を開くかは renderer が種類で決める）。選ばずに閉じたら null
   */
  "unifiedArchive:selectAnyImportFile":
    async (): Promise<SelectedArchiveImportFile | null> => {
      const result = await dialog.showOpenDialog({
        title: "読み込む",
        filters: ANY_IMPORT_FILE_FILTERS,
        properties: ["openFile"],
      })
      if (result.canceled || result.filePaths.length === 0) return null
      const filePath = result.filePaths[0]
      return { path: filePath, kind: archiveImportFileKindOf(filePath) }
    },

  /** 取り込みウィザードの中で、統合アーカイブを選び直す。選ばずに閉じたら null */
  "unifiedArchive:selectImportFile": async () => {
    const result = await dialog.showOpenDialog({
      title: "統合アーカイブを読み込む",
      filters: [ARCHIVE_FILE_FILTER],
      properties: ["openFile"],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  },

  /**
   * アーカイブを開いて現行化し、照合の候補と初期値を返す。守りに掛かったら `rejected`。
   * 開いたものは閉じるか取り込むまで main が持つ
   */
  "unifiedArchive:open": async (input: { archivePath: string }) => {
    const openResult = openUnifiedArchiveImportSession({
      archivePath: input.archivePath,
      migrationsDir: requireMigrationsDir(),
      referenceDatabasePath: getDatabasePath(),
    })
    if (openResult.kind === "rejected") {
      return {
        kind: "rejected" as const,
        reason: openResult.reason,
        details: [...openResult.details],
      }
    }

    const { sessionId, session } = openResult
    try {
      const matchCandidates = await findArchiveMatchCandidates(
        prismaArchiveTarget(prisma),
        session.opened
      )
      return {
        kind: "opened" as const,
        sessionId,
        manifest: session.opened.manifest,
        appliedMigrations: [...session.opened.appliedMigrations],
        migratedRowCounts: countIdLists(session.opened.migratedRowIds),
        matchCandidates,
        suggestedDecisions: suggestedMatchDecisions(matchCandidates),
      }
    } catch (error) {
      closeUnifiedArchiveImportSession(sessionId)
      throw error
    }
  },

  /**
   * 書いてからロールバックする試し取り込み（確認画面用）。解けない衝突は `unresolvable`。
   *
   * 成績算出への影響（docs §7.5）の材料として、成績算出が読む表へ書いた行の前と後
   * （`gradeInputChanges`）と、それを評価項目へ写す手がかり（`gradeImpactSource`）を生のまま
   * 同梱する。差分も写し方も renderer が持つ
   */
  "unifiedArchive:analyze": async (input: UnifiedArchiveImportInput) => {
    const session = getUnifiedArchiveImportSession(input.sessionId)
    try {
      const analysis = await analyzeUnifiedArchiveImport(
        prismaArchiveTransaction(prisma, IMPORT_TRANSACTION_TIMEOUT_MS),
        session.opened,
        input.action,
        input.decisions,
        new Date(),
        collectArchiveGradeImpactSource
      )
      return {
        kind: "ok" as const,
        result: analysis.result,
        gradeInputChanges: analysis.gradeInputChanges,
        gradeImpactSource: analysis.inspection,
      }
    } catch (error) {
      if (error instanceof UnifiedArchiveUnresolvableConflictError) {
        return { kind: "unresolvable" as const, reasons: error.reasons }
      }
      throw error
    }
  },

  /**
   * 取り込む。1本のトランザクションで行を書き、コミットの後に画像を写して監査ログを残す。
   * 成功したら作業を閉じる。解けない衝突は `unresolvable`（作業は開いたまま）
   */
  "unifiedArchive:import": async (input: UnifiedArchiveImportInput) => {
    const session = getUnifiedArchiveImportSession(input.sessionId)
    let result: Awaited<ReturnType<typeof importUnifiedArchiveRows>>
    try {
      result = await prismaArchiveTransaction(
        prisma,
        IMPORT_TRANSACTION_TIMEOUT_MS
      )((target) =>
        importUnifiedArchiveRows(
          target,
          session.opened,
          input.action,
          new Date(),
          input.decisions
        )
      )
    } catch (error) {
      if (error instanceof UnifiedArchiveUnresolvableConflictError) {
        return { kind: "unresolvable" as const, reasons: error.reasons }
      }
      throw error
    }

    const files = importUnifiedArchiveFiles(
      session.opened,
      getSharedFilesDirectory(),
      result
    )

    const countTotals = { created: 0, replaced: 0, kept: 0, skipped: 0 }
    for (const tableCounts of Object.values(result.counts)) {
      countTotals.created += tableCounts.created
      countTotals.replaced += tableCounts.replaced
      countTotals.kept += tableCounts.kept
      countTotals.skipped += tableCounts.skipped
    }
    const { manifest } = session.opened
    await recordAuditLog({
      action: "archive.unified.import",
      entityType: "UnifiedArchive",
      entityId: manifest.exportedAt,
      target: path.basename(session.archivePath),
      extra: {
        archivePath: session.archivePath,
        importAction: input.action,
        roots: countIdLists(manifest.selection.roots),
        counts: countTotals,
        uniqueConflictCount: result.uniqueConflicts.length,
        renamedIdCount: result.renamedIds.length,
        warningCount: result.warnings.length,
        files: {
          copied: files.copied.length,
          replaced: files.replaced.length,
          skipped: files.skipped.length,
          failed: files.failed.length,
        },
      },
    })

    closeUnifiedArchiveImportSession(input.sessionId)
    return { kind: "ok" as const, result, files }
  },

  /** 作業を閉じ、作業ディレクトリを消す（取り込まずにウィザードを閉じたとき） */
  "unifiedArchive:close": async (input: { sessionId: string }) => {
    closeUnifiedArchiveImportSession(input.sessionId)
  },
} satisfies HandlerMap
