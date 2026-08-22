/**
 * 「畳みが起きたときアプリが黙らない」ことの結合テスト（syncService を丸ごと動かす）
 *
 * `syncFoldNotification.test.ts` は `sqlite-nas-sync` をモックし、`setupSync` に渡された
 * `onAfterSync` をテストから直接呼んでいる。つまり **`folds` は手で書いた作り物** で、
 * 「本物の同期が本当に `folds` を返すのか」「返ったものが監査ログまで届くのか」は
 * 一度も通っていない。ここはその隙間を埋める:
 *
 * - ライブラリはモックしない（本物の `setupSync` で本物の畳みを起こす）
 * - 監査ログもモックしない（本物の `recordAuditLog` が本物の Prisma で書く）
 * - モックするのは Electron（`app.getPath` / `BrowserWindow`）と、
 *   データディレクトリの場所だけ
 *
 * 仕込みは実際に起きうる形にする — 2人の教員が同じ試験の同じ生徒を、
 * それぞれの端末で受験生徒として登録し、それぞれ採点した状態。
 * `ExamStudent` は `@@unique([examId, studentId])` なので2行は同居できない。
 *
 * ## パスについて
 *
 * `getDatabasePath()` は sync 有効時にローカルDB（`getLocalDbPath()`）を、無効時に
 * `getDataDirectory()/database.db` を返す。ここではどちらの枝を通っても Prisma の宛先が
 * **アプリと同じ「同期対象のローカルDB」** になるよう、データディレクトリを
 * 端末Aのローカル DB があるディレクトリに重ねている。
 * （分岐そのものの検証は `databasePath.test.ts`）
 */
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import type { SyncInstance, SyncResult } from "sqlite-nas-sync"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import type * as DataManagerModule from "../../electron-src/lib/dataManager"
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
/** 端末A（アプリ本体）のローカルDB。`getLocalDbPath()` が返すのと同じ場所 */
const LOCAL_DB_A = path.join(USER_DATA, "score-at-once", "database.db")
/** 上記の注記のとおり、Prisma の宛先をローカルDBへ重ねるためここを指す */
const DATA_DIR = path.dirname(LOCAL_DB_A)
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
  getDataDirectory: () => DATA_DIR,
}))

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

const readSyncMergeAuditLogs = (dbPath: string): AuditLogRow[] =>
  withDatabase(dbPath, (db) =>
    db
      .prepare<[], AuditLogRow>(
        `SELECT action, category, "userId" AS userId, "entityType" AS entityType,
                "entityId" AS entityId, summary, metadata, "coalesceKey" AS coalesceKey
           FROM "AuditLog" WHERE action = 'sync.merge' ORDER BY "entityId"`
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
  let rows = readSyncMergeAuditLogs(dbPath)
  for (
    let attempt = 0;
    attempt < 50 && rows.length < expectedCount;
    attempt++
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    rows = readSyncMergeAuditLogs(dbPath)
  }
  return rows
}

/** 端末Aで畳みが起きた同期の結果（`onAfterSync` が受け取るのと同じオブジェクト） */
let foldSyncResult: SyncResult
/** その次の巡回の結果（畳みのあとも同期が走ることを見る） */
let nextRoundResult: SyncResult
let auditLogs: AuditLogRow[]
/** 畳みが起きる直前の監査ログ（ここが空でないと「畳みで書かれた」と言えない） */
let auditLogsBeforeFold: AuditLogRow[]
let syncB: SyncInstance
let stopSyncOnA: () => Promise<void>
let disconnectPrisma: () => Promise<void>

beforeAll(async () => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  fs.mkdirSync(USER_DATA, { recursive: true })
  // Prisma クライアントはモジュール読み込み時に接続先を決めるので、DB を先に置く
  createClientDatabase(LOCAL_DB_A)
  createClientDatabase(DB_B)

  const { getSchemaVersion } =
    await import("../../electron-src/lib/sync/schemaVersion")
  const { getNasSyncPath, saveSyncConfig } =
    await import("../../electron-src/lib/sync/syncConfig")
  const { startSync, stopSync, triggerSyncNow } =
    await import("../../electron-src/lib/sync/syncService")
  const prismaModule = await import("../../electron-src/lib/prisma/client")
  stopSyncOnA = stopSync
  disconnectPrisma = () => prismaModule.default.$disconnect()

  const config = {
    enabled: true,
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
    getNasSyncPath(),
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

  // A が自分の行を出し、B がそれを取り込んで（B 側でも畳みが起きる）自分の行を出す
  await triggerSyncNow()
  await syncB.syncNow()

  // A がそれを取り込む。ここで A のローカル行が消える畳みが起きる
  sentToRenderer.length = 0
  auditLogsBeforeFold = readSyncMergeAuditLogs(LOCAL_DB_A)
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

describe("畳みが起きたときアプリが黙らない", () => {
  it("本物の同期が folds を返す（作り物ではない）", () => {
    const expectedFolds: SyncRecordFold[] = [
      {
        tableName: "ExamStudent",
        losingId: "exam-student-a",
        winningId: "exam-student-b",
        removedLocalRow: true,
        // 消える受験生徒にぶら下がっていた採点行1件が、残る側へ移る
        movedChildren: 1,
        // 引き継げず消えた子は無い（参照列を一時的に外せる形なので）
        lostChildren: 0,
      },
    ]
    expect(foldSyncResult.folds).toEqual(expectedFolds)
    // 畳みは行が1つ消える操作なので、消えた数にも出る
    expect(foldSyncResult.deleted).toBe(1)
  })

  it("畳みをそのまま renderer へ押し出す", () => {
    const foldMessages = sentToRenderer.filter(
      (message) => message.channel === "sync:records-folded"
    )
    expect(foldMessages).toHaveLength(1)
    // main は加工しない（数え上げは renderer 側）
    expect(foldMessages[0].payload).toEqual(foldSyncResult.folds)
  })

  it("畳みを監査ログへ残す（消えた行が対象・操作者は null・システム操作）", () => {
    // 直前まで1件も無かったものが、この同期で書かれた
    expect(auditLogsBeforeFold).toEqual([])
    expect(auditLogs).toHaveLength(1)
    const auditLog = auditLogs[0]
    expect(auditLog.category).toBe("system")
    expect(auditLog.userId).toBeNull()
    expect(auditLog.entityType).toBe("ExamStudent")
    expect(auditLog.entityId).toBe("exam-student-a")
    expect(auditLog.summary).toBe(
      "同期で重複していた試験の受験生徒を1つにまとめました"
    )
    expect(auditLog.coalesceKey).toBe("sync.merge:ExamStudent:exam-student-a")
    expect(JSON.parse(auditLog.metadata ?? "{}")).toMatchObject({
      losingId: "exam-student-a",
      winningId: "exam-student-b",
      removedLocalRow: true,
    })
  })

  it("畳まれても採点は消えず、勝った受験生徒へ移っている", () => {
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

  it("畳みのあとも次の巡回が正常に走る", () => {
    expect(blockingWarnings(nextRoundResult.warnings)).toEqual([])
    expect(nextRoundResult.clientsSynced).toBe(1)
    // 畳み直しが続くなら収束していない
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
