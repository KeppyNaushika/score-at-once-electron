/**
 * 統合アーカイブ（.sao）の IPC ハンドラーを、画面と同じ順に通す
 *
 * テスト対象: electron-src/ipc-handlers/unifiedArchiveHandlers.ts
 *
 * 下見 → 書き出し → 開く → 試し取り込み → 取り込み → 閉じる を、ハンドラー経由で通す。
 * 規則そのもの（範囲・現行化・行の書き方）は core の各テストが見るので、ここはつなぎ目
 * （ダイアログ・DB とデータディレクトリの場所・進捗・監査ログ・作業の出し入れ・失敗の返し方）を見る。
 *
 * 書き出しと下見は main では作業者（utilityProcess）が行う。作業者はテストでは起こせないので、
 * `utilityProcess.fork` を、作業者と同じ `runArchiveExportJob` をこのプロセスで動かし、返事を
 * 非同期に返す偽物に差し替える（依頼・返事の受け渡しと、失敗の戻し方はハンドラーのまま通る）。
 *
 * テスト DB は `_prisma_migrations` を持たないので、unifiedArchiveRoundTrip.test.ts と同じく
 * 複製にアプリの全 migration を適用済みとして記録し、それを「ライブ DB」（getDatabasePath）にする。
 * 書き込みはテスト DB（Prisma）へ行く。
 */

import Database from "better-sqlite3"
import * as crypto from "crypto"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const WORK_DIR = path.join(os.tmpdir(), "unified-archive-handlers")
const DATA_DIR = path.join(WORK_DIR, "data")
const SOURCE_PATH = path.join(WORK_DIR, "source.db")
const OUTPUT_PATH = path.join(WORK_DIR, "書き出し.sao")

const electronMocks = vi.hoisted(() => ({
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn(),
  send: vi.fn(),
  fork: vi.fn(),
}))
vi.mock("electron", async () => {
  const { runArchiveExportJob } =
    await import("../../../electron-src/lib/export/unified-archive/archiveExportJob")
  /** 作業者の偽物。依頼をこのプロセスでこなし、返事は次の周回で届ける（本物も非同期に届く） */
  const forkInProcessWorker = () => {
    const messageListeners: ((
      response: ArchiveExportWorkerResponse
    ) => void)[] = []
    return {
      postMessage: (request: ArchiveExportWorkerRequest) => {
        void runArchiveExportJob(request, (response) =>
          setImmediate(() =>
            messageListeners.forEach((listener) => listener(response))
          )
        )
      },
      on: (
        event: string,
        listener: (response: ArchiveExportWorkerResponse) => void
      ) => {
        if (event === "message") messageListeners.push(listener)
      },
      kill: () => true,
    }
  }
  electronMocks.fork.mockImplementation(forkInProcessWorker)
  return {
    app: {
      getVersion: () => "0.0.0-test",
      getAppPath: () => process.cwd(),
    },
    dialog: {
      showSaveDialog: electronMocks.showSaveDialog,
      showOpenDialog: electronMocks.showOpenDialog,
    },
    BrowserWindow: {
      getAllWindows: () => [{ webContents: { send: electronMocks.send } }],
    },
    ipcMain: { handle: vi.fn() },
    utilityProcess: { fork: electronMocks.fork },
  }
})

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

vi.mock("../../../electron-src/lib/dataManager", () => ({
  getSharedFilesDirectory: () => DATA_DIR,
}))

vi.mock("../../../electron-src/lib/prisma/databaseInitializer", () => ({
  getDatabasePath: () => SOURCE_PATH,
}))

const actor = vi.hoisted((): { userId: string | null } => ({
  userId: null,
}))
vi.mock("../../../electron-src/lib/prisma/auditActor", () => ({
  getCurrentActorUserId: () => actor.userId,
}))

import { unifiedArchiveHandlers } from "../../../electron-src/ipc-handlers/unifiedArchiveHandlers"
import type {
  ArchiveExportWorkerRequest,
  ArchiveExportWorkerResponse,
} from "../../../electron-src/lib/export/unified-archive/archiveExportJob"
import { ArchiveScopeError } from "../../../electron-src/lib/export/unified-archive/archiveScopeResolver"
import { listLocalMigrationNames } from "../../../electron-src/lib/prisma/schema/migrationApplier"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"
import {
  createUnifiedArchiveFileFixture,
  type UnifiedArchiveFileFixture,
  writeDataDirectoryFiles,
} from "../../helpers/unifiedArchiveFileFixture"
import {
  createUnifiedArchiveFixture,
  type UnifiedArchiveFixture,
} from "../../helpers/unifiedArchiveFixture"

const prisma = getTestPrismaClient()
const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")
const APP_MIGRATIONS_DIR = path.resolve(__dirname, "../../../prisma/migrations")

/** テスト DB を複製し、アプリの全 migration を適用済みとして記録する */
const createSourceWithMigrations = (): void => {
  fs.rmSync(SOURCE_PATH, { force: true })
  const testDatabase = new Database(TEST_DB_PATH, {
    readonly: true,
    fileMustExist: true,
  })
  try {
    testDatabase.prepare<[string]>("VACUUM INTO ?").run(SOURCE_PATH)
  } finally {
    testDatabase.close()
  }
  const source = new Database(SOURCE_PATH, { fileMustExist: true })
  try {
    source.exec(`DROP TABLE IF EXISTS "_prisma_migrations"`)
    source.exec(`
      CREATE TABLE "_prisma_migrations" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "checksum" TEXT NOT NULL,
        "finished_at" DATETIME,
        "migration_name" TEXT NOT NULL,
        "logs" TEXT,
        "rolled_back_at" DATETIME,
        "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )
    `)
    const insertMigration = source.prepare<[string, string]>(
      `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count)
       VALUES (?, 'checksum', ?, '2026-10-04T00:00:00.000Z', 1)`
    )
    for (const migrationName of listLocalMigrationNames(APP_MIGRATIONS_DIR)) {
      insertMigration.run(crypto.randomUUID(), migrationName)
    }
  } finally {
    source.close()
  }
}

describe("統合アーカイブの IPC ハンドラー", () => {
  let fixture: UnifiedArchiveFixture
  let fileFixture: UnifiedArchiveFileFixture

  const allImagePaths = (): string[] =>
    [
      ...new Set([
        ...fileFixture.examPageImagePaths,
        ...fileFixture.studentAnswerImagePaths,
        ...fileFixture.asbImagePaths,
      ]),
    ].sort()

  const fullSelection = () => ({
    roots: {
      Exam: [fixture.examA.exam.id],
      Coursework: [fixture.courseworkId],
      Grade: [fixture.gradeId],
      AsbDefinition: [fileFixture.asbDefinitionId],
    },
  })

  /** 書き出しまでを済ませる（ダイアログは OUTPUT_PATH を返す） */
  const exportFullSelection = async () => {
    electronMocks.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: OUTPUT_PATH,
    })
    const outputPath =
      await unifiedArchiveHandlers["unifiedArchive:selectExportPath"](
        "試験A.sao"
      )
    if (outputPath === null) throw new Error("書き出し先が選ばれていません")
    return unifiedArchiveHandlers["unifiedArchive:export"]({
      selection: fullSelection(),
      outputPath,
    })
  }

  /** 書き出したアーカイブを開く（ダイアログは OUTPUT_PATH を返す） */
  const openExported = async () => {
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [OUTPUT_PATH],
    })
    const archivePath =
      await unifiedArchiveHandlers["unifiedArchive:selectImportFile"]()
    if (archivePath === null) throw new Error("ファイルが選ばれていません")
    const opened = await unifiedArchiveHandlers["unifiedArchive:open"]({
      archivePath,
    })
    if (opened.kind !== "opened") {
      throw new Error(`開けませんでした: ${opened.reason}`)
    }
    return opened
  }

  /** 書き出した後、DB とデータディレクトリを空にする（別の端末へ取り込む状況） */
  const emptyTarget = async () => {
    await cleanupTestDatabase()
    fs.rmSync(DATA_DIR, { recursive: true, force: true })
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    await cleanupTestDatabase()
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fixture = await createUnifiedArchiveFixture(prisma)
    fileFixture = await createUnifiedArchiveFileFixture(prisma, fixture)
    writeDataDirectoryFiles(DATA_DIR, allImagePaths())
    actor.userId = fixture.examA.user.id
    createSourceWithMigrations()
  })

  afterAll(async () => {
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
    await disconnectTestPrisma()
  })

  it("下見: 範囲の件数・実体の id・成績算出が使うため外せないもの・欠けた画像を返す", async () => {
    const missingImagePath = fileFixture.studentAnswerImagePaths[0]
    fs.rmSync(path.join(DATA_DIR, ...missingImagePath.split("/")))

    const preview = await unifiedArchiveHandlers[
      "unifiedArchive:previewExport"
    ]({ roots: { Grade: [fixture.gradeId] } })

    if (preview.kind !== "ok") throw new Error(preview.kind)
    // 成績算出を選ぶと、使う試験・資料と比較先の成績算出が入る（§5.2）
    expect(preview.entityIds.Grade.sort()).toEqual(
      [fixture.gradeId, fixture.comparedGradeId].sort()
    )
    expect(preview.entityIds.Exam).toEqual([fixture.examA.exam.id])
    expect(preview.entityIds.Coursework).toEqual([fixture.courseworkId])
    expect(preview.entityIds.Student.length).toBeGreaterThan(0)
    expect(preview.rowCounts.Exam).toBe(1)
    expect(preview.rowCounts.GradeDataSource).toBe(2)
    expect(preview.excludedRowCounts).toEqual({})
    expect(preview.forcedBy[`Exam:${fixture.examA.exam.id}`]).toEqual([
      fixture.gradeId,
    ])
    expect(preview.forcedBy[`Coursework:${fixture.courseworkId}`]).toEqual([
      fixture.gradeId,
    ])
    expect(
      preview.forcedBy[`CourseworkItem:${fixture.courseworkItemId}`]
    ).toEqual([fixture.gradeId])
    // 比較先の成績算出は既定で入るが、外せる
    expect(preview.forcedBy[`Grade:${fixture.comparedGradeId}`]).toBeUndefined()
    expect(preview.missingFiles).toEqual([
      { path: missingImagePath, reason: "notFound" },
    ])
  })

  it("下見: 外したものは excludedRowCounts に、成績算出が使うものを外すと forcedExcluded で返す", async () => {
    const excluded = await unifiedArchiveHandlers[
      "unifiedArchive:previewExport"
    ]({
      roots: { Grade: [fixture.gradeId] },
      exclusions: { Grade: [fixture.comparedGradeId] },
    })
    if (excluded.kind !== "ok") throw new Error(excluded.kind)
    expect(excluded.entityIds.Grade).toEqual([fixture.gradeId])
    expect(excluded.excludedRowCounts.Grade).toBe(1)
    expect(excluded.excludedRowCounts.GradeComparison).toBe(1)

    const forced = await unifiedArchiveHandlers["unifiedArchive:previewExport"](
      {
        roots: { Grade: [fixture.gradeId] },
        exclusions: { Exam: [fixture.examA.exam.id] },
      }
    )
    expect(forced.kind).toBe("forcedExcluded")
    if (forced.kind !== "forcedExcluded") return
    expect(forced.violations).toEqual([
      expect.objectContaining({
        table: "GradeDataSource",
        id: fixture.dataSourceIds[0],
        column: "examId",
        target: `Exam(${fixture.examA.exam.id})`,
      }),
    ])
  })

  it("書き出し: 成績算出が使うものを外すと、作業者からの ArchiveScopeError をそのまま投げ、一時ファイルも監査ログも残さない", async () => {
    const exporting = unifiedArchiveHandlers["unifiedArchive:export"]({
      selection: {
        roots: { Grade: [fixture.gradeId] },
        exclusions: { Exam: [fixture.examA.exam.id] },
      },
      outputPath: OUTPUT_PATH,
    })

    await expect(exporting).rejects.toBeInstanceOf(ArchiveScopeError)
    await expect(exporting).rejects.toMatchObject({
      violations: [
        expect.objectContaining({
          table: "GradeDataSource",
          column: "examId",
          target: `Exam(${fixture.examA.exam.id})`,
        }),
      ],
    })
    expect(fs.existsSync(OUTPUT_PATH)).toBe(false)
    expect(
      fs.readdirSync(WORK_DIR).filter((name) => name.endsWith(".partial"))
    ).toEqual([])
    expect(
      await prisma.auditLog.count({
        where: { action: "archive.unified.export" },
      })
    ).toBe(0)
  })

  it("書き出し → 開く → 試し取り込み → 取り込みを通すと、行と画像が入り、進捗と監査ログが残り、作業が閉じる", async () => {
    const exported = await exportFullSelection()

    expect(electronMocks.showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: "試験A.sao" })
    )
    expect(exported.outputPath).toBe(OUTPUT_PATH)
    expect(fs.existsSync(OUTPUT_PATH)).toBe(true)
    // 一時ファイルは残さない
    expect(
      fs.readdirSync(WORK_DIR).filter((name) => name.endsWith(".partial"))
    ).toEqual([])
    expect(exported.manifest.exportedByUserId).toBe(fixture.examA.user.id)
    expect(exported.manifest.files.missing).toEqual([])
    expect(
      electronMocks.send.mock.calls.map(([channel, phase]) => [channel, phase])
    ).toEqual([
      ["unifiedArchive:export-progress", "resolvingScope"],
      ["unifiedArchive:export-progress", "writingDatabase"],
      ["unifiedArchive:export-progress", "packing"],
    ])
    const exportLog = await prisma.auditLog.findFirstOrThrow({
      where: { action: "archive.unified.export" },
    })
    expect(exportLog).toMatchObject({
      category: "system",
      entityType: "UnifiedArchive",
      entityId: "書き出し.sao",
      userId: fixture.examA.user.id,
    })
    expect(JSON.parse(exportLog.metadata ?? "{}")).toMatchObject({
      roots: { Exam: 1, Coursework: 1, Grade: 1, AsbDefinition: 1 },
      missingFileCount: 0,
    })

    await emptyTarget()
    const opened = await openExported()
    expect(opened.manifest.exportedAt).toBe(exported.manifest.exportedAt)
    expect(opened.appliedMigrations).toEqual([])
    expect(opened.migratedRowCounts).toEqual({})
    // 空の取り込み先には候補が無く、初期値は全て新規
    expect(opened.matchCandidates.length).toBeGreaterThan(0)
    expect(
      opened.matchCandidates.every(
        (matchCandidate) => matchCandidate.candidates.length === 0
      )
    ).toBe(true)
    expect(
      Object.values(opened.suggestedDecisions).every(
        (decision) => decision.kind === "new"
      )
    ).toBe(true)

    const analyzed = await unifiedArchiveHandlers["unifiedArchive:analyze"]({
      sessionId: opened.sessionId,
      action: "merge",
      decisions: { matches: opened.suggestedDecisions },
    })
    if (analyzed.kind !== "ok") throw new Error(analyzed.kind)
    expect(analyzed.result.counts.Exam).toEqual({
      created: 1,
      replaced: 0,
      kept: 0,
      skipped: 0,
    })
    // 試し取り込みはロールバックする
    expect(await prisma.exam.count()).toBe(0)

    const imported = await unifiedArchiveHandlers["unifiedArchive:import"]({
      sessionId: opened.sessionId,
      action: "merge",
      decisions: { matches: opened.suggestedDecisions },
    })
    if (imported.kind !== "ok") throw new Error(imported.kind)
    expect(imported.result.counts).toEqual(analyzed.result.counts)
    expect(
      await prisma.exam.findUnique({ where: { id: fixture.examA.exam.id } })
    ).not.toBeNull()
    expect(
      await prisma.grade.findUnique({ where: { id: fixture.gradeId } })
    ).not.toBeNull()
    expect(imported.files.failed).toEqual([])
    expect(imported.files.copied.sort()).toEqual(allImagePaths())

    const importLog = await prisma.auditLog.findFirstOrThrow({
      where: { action: "archive.unified.import" },
    })
    expect(importLog).toMatchObject({
      category: "system",
      entityType: "UnifiedArchive",
      entityId: exported.manifest.exportedAt,
    })
    expect(JSON.parse(importLog.metadata ?? "{}")).toMatchObject({
      importAction: "merge",
      counts: { replaced: 0, kept: 0, skipped: 0 },
      files: { copied: allImagePaths().length, failed: 0 },
    })

    // 取り込んだら作業は閉じている
    await expect(
      unifiedArchiveHandlers["unifiedArchive:analyze"]({
        sessionId: opened.sessionId,
        action: "merge",
        decisions: {},
      })
    ).rejects.toThrow("取り込みの作業が見つかりません")
  })

  it("解けない決定は unresolvable で返し、作業は開いたまま。閉じたら使えない", async () => {
    await exportFullSelection()
    await emptyTarget()
    const opened = await openExported()
    const studentCandidate = opened.matchCandidates.find(
      (matchCandidate) => matchCandidate.table === "Student"
    )
    if (!studentCandidate) throw new Error("生徒の照合の行がありません")
    const decisions = {
      matches: {
        [`Student:${studentCandidate.archiveId}`]: {
          kind: "same" as const,
          existingId: crypto.randomUUID(),
          adoptId: "existing" as const,
        },
      },
    }

    const analyzed = await unifiedArchiveHandlers["unifiedArchive:analyze"]({
      sessionId: opened.sessionId,
      action: "merge",
      decisions,
    })
    expect(analyzed.kind).toBe("unresolvable")
    if (analyzed.kind !== "unresolvable") return
    expect(analyzed.reasons.map((reason) => reason.kind)).toContain(
      "matchTargetMissing"
    )

    const imported = await unifiedArchiveHandlers["unifiedArchive:import"]({
      sessionId: opened.sessionId,
      action: "merge",
      decisions,
    })
    expect(imported.kind).toBe("unresolvable")
    expect(await prisma.exam.count()).toBe(0)
    expect(
      await prisma.auditLog.count({
        where: { action: "archive.unified.import" },
      })
    ).toBe(0)

    await unifiedArchiveHandlers["unifiedArchive:close"]({
      sessionId: opened.sessionId,
    })
    // 2度閉じても失敗しない
    await unifiedArchiveHandlers["unifiedArchive:close"]({
      sessionId: opened.sessionId,
    })
    await expect(
      unifiedArchiveHandlers["unifiedArchive:analyze"]({
        sessionId: opened.sessionId,
        action: "merge",
        decisions: {},
      })
    ).rejects.toThrow("取り込みの作業が見つかりません")
  })

  it("統合アーカイブでないファイルは rejected で理由を返す。ダイアログを閉じたら null", async () => {
    const notArchivePath = path.join(WORK_DIR, "not-archive.sao")
    fs.writeFileSync(notArchivePath, "これは ZIP ではない")

    const rejected = await unifiedArchiveHandlers["unifiedArchive:open"]({
      archivePath: notArchivePath,
    })
    expect(rejected).toMatchObject({ kind: "rejected", reason: "notArchive" })

    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: [],
    })
    electronMocks.showSaveDialog.mockResolvedValue({
      canceled: true,
      filePath: undefined,
    })
    expect(
      await unifiedArchiveHandlers["unifiedArchive:selectImportFile"]()
    ).toBeNull()
    expect(
      await unifiedArchiveHandlers["unifiedArchive:selectExportPath"]("a.sao")
    ).toBeNull()
  })
})
