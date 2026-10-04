/**
 * 「かぶった行の片方が隠れたときアプリが黙らない」ことの結合テスト（syncService を丸ごと動かす）
 *
 * `syncFoldNotification.test.ts` は `sqlite-nas-sync` をモックし、`setupSync` に渡された
 * `onAfterSync` をテストから直接呼んでいる。つまり **`folds` は手で書いた作り物** で、
 * 「本物の同期が本当に `folds` を返すのか」「返ったものが監査ログまで届くのか」は
 * 一度も通っていない。ここはその隙間を埋める:
 *
 * - ライブラリはモックしない（本物の `setupSync` で本物のかぶりを起こす）
 * - 監査ログもモックしない（本物の `recordAuditLog` が本物の Prisma で書く）
 * - モックするのは Electron（`app.getPath` / `BrowserWindow`）と、
 *   データディレクトリの場所だけ
 *
 * 仕込みは実際に起きうる形にする — 2人の教員が同じ試験の同じ生徒を、
 * それぞれの端末で受験生徒として登録し、それぞれ採点した状態。
 * `ExamStudent` は `@@unique([examId, studentId])` なので2行は同時に表示できず、
 * sqlite-nas-sync v0.20.0 は弱い方を隠す（v0.19.0 までは消して1つへ畳んでいた）。
 *
 * ## パスについて
 *
 * 同期は共有モードで起動したときだけ動く。ここでは根を共有モードで確定し、端末Aの
 * 手元の控え（`data/shared/<識別id>/` の DB）を Prisma の宛先にする。共有フォルダには
 * 識別ファイルを置く（同期は、識別ファイルの id が合うときだけ写しを置く）。
 */
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import type { SyncInstance, SyncResult } from "sqlite-nas-sync"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import type * as DataManagerModule from "../../electron-src/lib/dataManager"
import {
  computeSharedRoots,
  fixStorageRoots,
} from "../../electron-src/lib/storageRoots"
import {
  getSharedFolderSyncDirectory,
  getSharedReplicaDatabasePath,
  writeSharedFolderMarker,
} from "../../electron-src/lib/sync/sharedFolder"
import type { SyncRecordFold } from "../../electron-src/lib/sync/types"
import {
  blockingWarnings,
  createClientDatabase,
  createSyncInstance,
  insertExamStudent,
  insertQuestionScore,
  isoMinutesAgo,
  questionScoreRows,
  seedScoringSkeleton,
  withDatabase,
} from "./twoClientHarness"

const TEST_ROOT = path.join(os.tmpdir(), "score-at-once-sync-service-fold")
const USER_DATA = path.join(TEST_ROOT, "userData")
/** 端末A（アプリ本体）の data */
const DATA_DIR = path.join(TEST_ROOT, "data")
/** 共有フォルダ */
const SHARED_FOLDER = path.join(TEST_ROOT, "shared-folder")
const SHARED_FOLDER_ID = "0d6f2b7e-3c1a-4f5b-8e2d-9a7c4b1e6f30"
/** 端末A（アプリ本体）の手元の控え */
const LOCAL_DB_A = getSharedReplicaDatabasePath(DATA_DIR, SHARED_FOLDER_ID)
/** 端末B（相手のPC）。アプリは通さず、ライブラリだけで動かす */
const DB_B = path.join(TEST_ROOT, "client-b", "database.db")

/** renderer へ送られたメッセージ（`BrowserWindow` のモックが溜める） */
const sentToRenderer: Array<{ channel: string; payload: unknown }> = []

vi.mock("electron", () => ({
  app: {
    getPath: () => USER_DATA,
    getAppPath: () => TEST_ROOT,
    isPackaged: false,
  },
  BrowserWindow: {
    getAllWindows: () => [
      {
        webContents: {
          send: (channel: string, payload: unknown) => {
            sentToRenderer.push({ channel, payload })
          },
        },
      },
    ],
  },
}))

vi.mock("../../electron-src/lib/dataManager", async (importOriginal) => ({
  ...(await importOriginal<typeof DataManagerModule>()),
  getLocalDataDirectory: () => DATA_DIR,
}))

fixStorageRoots(
  computeSharedRoots(DATA_DIR, {
    sharedFolderId: SHARED_FOLDER_ID,
    sharedFolderPath: SHARED_FOLDER,
  })
)

interface AuditLogRow {
  action: string
  category: string
  userId: string | null
  entityType: string
  entityId: string
  summary: string
  metadata: string | null
  coalesceKey: string | null
}

/** 同期が書く監査ログ（隠した・戻した。過去の `sync.merge` も拾って、書かれていないことを見る） */
const readSyncAuditLogs = (dbPath: string): AuditLogRow[] =>
  withDatabase(dbPath, (db) =>
    db
      .prepare<[], AuditLogRow>(
        `SELECT action, category, "userId" AS userId, "entityType" AS entityType,
                "entityId" AS entityId, summary, metadata, "coalesceKey" AS coalesceKey
           FROM "AuditLog" WHERE action LIKE 'sync.%' ORDER BY "entityId"`
      )
      .all()
  )

/**
 * 監査ログの書き込みは同期のコールバックから切り離して走る（`void recordFoldAuditLogs`）。
 * 行が現れるまで待ち、現れなければ待ち切って**そのまま**返す
 * （ここで投げると仕込み全体が中断して、他の観点まで判定できなくなる）。
 */
const waitForAuditLogs = async (
  dbPath: string,
  expectedCount: number
): Promise<AuditLogRow[]> => {
  let rows = readSyncAuditLogs(dbPath)
  for (
    let attempt = 0;
    attempt < 50 && rows.length < expectedCount;
    attempt++
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    rows = readSyncAuditLogs(dbPath)
  }
  return rows
}

/** 端末Aで行が隠れた同期の結果（`onAfterSync` が受け取るのと同じオブジェクト） */
let foldSyncResult: SyncResult
/** その次の巡回の結果（隠れたあとも同期が走ることを見る） */
let nextRoundResult: SyncResult
let auditLogs: AuditLogRow[]
/** 行が隠れる直前の監査ログ（ここが空でないと「隠れたことで書かれた」と言えない） */
let auditLogsBeforeFold: AuditLogRow[]
let syncB: SyncInstance
let stopSyncOnA: () => Promise<void>
let disconnectPrisma: () => Promise<void>

beforeAll(async () => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(USER_DATA, { recursive: true })
  fs.mkdirSync(SHARED_FOLDER, { recursive: true })
  writeSharedFolderMarker(SHARED_FOLDER, SHARED_FOLDER_ID)
  // Prisma クライアントはモジュール読み込み時に接続先を決めるので、DB を先に置く
  createClientDatabase(LOCAL_DB_A)
  createClientDatabase(DB_B)

  const { getSchemaVersion } =
    await import("../../electron-src/lib/sync/schemaVersion")
  const { saveSyncConfig } =
    await import("../../electron-src/lib/sync/syncConfig")
  const { DEFAULT_SYNC_CONFIG } =
    await import("../../electron-src/lib/sync/types")
  const { startSync, stopSync, triggerSyncNow } =
    await import("../../electron-src/lib/sync/syncService")
  const prismaModule = await import("../../electron-src/lib/prisma/client")
  stopSyncOnA = stopSync
  disconnectPrisma = () => prismaModule.default.$disconnect()

  const config = {
    ...DEFAULT_SYNC_CONFIG,
    clientId: "client-a",
    // テストは syncNow を明示的に呼ぶ。定期実行に割り込まれないよう十分長く取る
    intervalMs: 600_000,
    changelogRetentionDays: 7,
  }
  saveSyncConfig(config)
  await startSync(config)

  // 端末B。スキーマバージョンが違うと相手ごとスキップされるので A と揃える
  syncB = createSyncInstance(
    DB_B,
    "client-b",
    getSharedFolderSyncDirectory(SHARED_FOLDER),
    getSchemaVersion()
  )

  // 試験・生徒・採点枠までを共有する（ここまでは衝突しない）
  const skeleton = seedScoringSkeleton(LOCAL_DB_A, isoMinutesAgo(60))
  await triggerSyncNow()
  await syncB.syncNow()

  // 2人の教員が、同じ生徒をそれぞれの端末で受験生徒として登録して採点した
  insertExamStudent(LOCAL_DB_A, {
    id: "exam-student-a",
    examId: skeleton.examId,
    studentId: skeleton.studentId,
    updatedAt: isoMinutesAgo(40),
  })
  insertQuestionScore(LOCAL_DB_A, {
    id: "question-score-a",
    cropRegionId: skeleton.cropRegionId,
    examStudentId: "exam-student-a",
    userId: skeleton.userId,
    status: "correct",
    updatedAt: isoMinutesAgo(40),
  })
  insertExamStudent(DB_B, {
    id: "exam-student-b",
    examId: skeleton.examId,
    studentId: skeleton.studentId,
    updatedAt: isoMinutesAgo(20),
  })
  insertQuestionScore(DB_B, {
    id: "question-score-b",
    cropRegionId: skeleton.cropRegionId,
    examStudentId: "exam-student-b",
    userId: skeleton.userId,
    status: "incorrect",
    updatedAt: isoMinutesAgo(20),
  })

  // A が自分の行を出し、B がそれを取り込んで（B 側でも隠れる）自分の行を出す
  await triggerSyncNow()
  await syncB.syncNow()

  // A がそれを取り込む。ここで A が表示していた exam-student-a が隠れる
  sentToRenderer.length = 0
  auditLogsBeforeFold = readSyncAuditLogs(LOCAL_DB_A)
  foldSyncResult = await triggerSyncNow()
  auditLogs = await waitForAuditLogs(LOCAL_DB_A, 1)

  nextRoundResult = await triggerSyncNow()
}, 60_000)

afterAll(async () => {
  syncB.stop()
  await stopSyncOnA()
  await disconnectPrisma()
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

describe("かぶった行の片方が隠れたときアプリが黙らない", () => {
  it("本物の同期が folds を返す（作り物ではない）", () => {
    const expectedFolds: SyncRecordFold[] = [
      {
        tableName: "ExamStudent",
        losingId: "exam-student-a",
        winningId: "exam-student-b",
      },
    ]
    expect(foldSyncResult.folds).toEqual(expectedFolds)
    // 隠れた行は表から外れるので、消えた数に出る（事実は残っている）
    expect(foldSyncResult.deleted).toBe(1)
    expect(foldSyncResult.restores ?? []).toEqual([])
  })

  it("隠れた行をそのまま renderer へ押し出す", () => {
    const foldMessages = sentToRenderer.filter(
      (message) => message.channel === "sync:record-folds-changed"
    )
    expect(foldMessages).toHaveLength(1)
    // main は加工しない（数え上げは renderer 側）
    expect(foldMessages[0].payload).toEqual({
      folds: foldSyncResult.folds,
      restores: [],
    })
  })

  it("隠したことを監査ログへ残す（隠れた行が対象・操作者は null・システム操作）", () => {
    // 直前まで1件も無かったものが、この同期で書かれた
    expect(auditLogsBeforeFold).toEqual([])
    expect(auditLogs).toHaveLength(1)
    const auditLog = auditLogs[0]
    // 行を消していないので、v0.19.0 までの `sync.merge` では書かない
    expect(auditLog.action).toBe("sync.duplicate.hide")
    expect(auditLog.category).toBe("system")
    expect(auditLog.userId).toBeNull()
    expect(auditLog.entityType).toBe("ExamStudent")
    expect(auditLog.entityId).toBe("exam-student-a")
    expect(auditLog.summary).toBe(
      "同期で重複していた試験の受験生徒の片方を隠しました"
    )
    expect(auditLog.coalesceKey).toBe(
      "sync.duplicate.hide:ExamStudent:exam-student-a"
    )
    expect(JSON.parse(auditLog.metadata ?? "{}")).toMatchObject({
      losingId: "exam-student-a",
      winningId: "exam-student-b",
    })
  })

  it("隠れても採点は消えず、表示している受験生徒の下に見えている", () => {
    expect(questionScoreRows(LOCAL_DB_A)).toEqual([
      {
        id: "question-score-a",
        examStudentId: "exam-student-b",
        status: "correct",
      },
      {
        id: "question-score-b",
        examStudentId: "exam-student-b",
        status: "incorrect",
      },
    ])
  })

  it("隠れたあとも次の巡回が正常に走る", () => {
    expect(blockingWarnings(nextRoundResult.warnings)).toEqual([])
    expect(nextRoundResult.clientsSynced).toBe(1)
    // 隠し直しが続くなら収束していない
    expect(nextRoundResult.folds).toEqual([])
  })

  it("同期の状態が idle に戻り、回数が数えられている", async () => {
    const { getSyncStatus } =
      await import("../../electron-src/lib/sync/syncService")
    const status = getSyncStatus()
    expect(status.state).toBe("idle")
    expect(status.lastError).toBeNull()
    expect(status.syncCount).toBeGreaterThanOrEqual(4)
    // 同じスキーマバージョンなので相手はスキップされていない
    expect(status.versionMismatches).toEqual([])
  })
})
