/**
 * 同期の「畳み」を伝える経路のユニットテスト（docs/remaining-work.md 段階57）
 *
 * 畳みは別id・同一ユニークキーの行を1つへまとめる操作で、黙って行が1つ消える。
 * ここで見るのは「起きた瞬間に renderer へ押し出すか」と「監査ログへ残すか」の2点。
 * ライブラリ本体（sqlite-nas-sync）はモックし、`setupSync` に渡した `onAfterSync` を
 * 捕まえて直接呼ぶ（同期そのものの検証はライブラリ側のテストが持つ）。
 */

import * as fs from "fs"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DATA_DIR = path.join("/tmp", `sync-fold-data-${Date.now()}`)
const TEST_LOCAL_DIR = path.join("/tmp", `sync-fold-local-${Date.now()}`)

const sentToRenderer: Array<{ channel: string; payload: unknown }> = []

vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => {
      if (name === "userData") return TEST_LOCAL_DIR
      return "/tmp/test"
    },
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

vi.mock("../../electron-src/lib/dataManager", () => ({
  getDataDirectory: () => TEST_DATA_DIR,
}))

vi.mock("../../electron-src/lib/prisma/databaseInitializer", () => ({
  getDatabasePath: () =>
    path.join(TEST_LOCAL_DIR, "score-at-once", "database.db"),
}))

// 監査ログは書き込み先（Prisma）を持ち込まずに呼び出しだけ見る
const mockRecordAuditLog = vi.fn().mockResolvedValue(undefined)
vi.mock("../../electron-src/lib/prisma/auditLog", () => ({
  recordAuditLog: (input: unknown) => mockRecordAuditLog(input),
}))

/** `setupSync` に渡された `onAfterSync`。テストから直接呼ぶ */
type CapturedAfterSync = (localDb: unknown, result: unknown) => void
let capturedOnAfterSync: CapturedAfterSync | undefined

vi.mock("sqlite-nas-sync", () => ({
  setupSync: vi.fn((config: { onAfterSync?: CapturedAfterSync }) => {
    capturedOnAfterSync = config.onAfterSync
    return {
      syncNow: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      on: vi.fn(),
      getStatus: () => ({
        isSyncing: false,
        lastSyncedAt: null,
        lastResult: null,
        isRunning: false,
      }),
    }
  }),
}))

import { saveSyncConfig } from "../../electron-src/lib/sync/syncConfig"
import { startSync, stopSync } from "../../electron-src/lib/sync/syncService"
import {
  DEFAULT_SYNC_CONFIG,
  type SyncRecordFold,
} from "../../electron-src/lib/sync/types"

/** 畳みが1件だけ載った同期結果（他の統計は使わないので0で埋める） */
const syncResultWithFolds = (folds: SyncRecordFold[]) => ({
  clientsSynced: 1,
  inserted: 0,
  updated: 0,
  deleted: folds.length,
  skipped: 0,
  conflictsResolved: folds.length,
  folds,
  warnings: [],
  skippedRemotes: [],
  hadChangelogGap: false,
})

/**
 * 監査ログの記録は同期のコールバックから切り離して走る（`void`）ので、
 * 呼ばれ切るまで待つ。マイクロタスクを1周させるだけでは足りない回があるため
 * タイマーで挟む。
 */
const waitForDetachedWrites = () =>
  new Promise((resolve) => setTimeout(resolve, 0))

const startWithCapturedCallback = async () => {
  const config = {
    ...DEFAULT_SYNC_CONFIG,
    enabled: true,
    clientId: "test-client",
  }
  saveSyncConfig(config)
  await startSync(config)
  if (capturedOnAfterSync === undefined) {
    throw new Error("onAfterSync が setupSync に渡されていない")
  }
  return capturedOnAfterSync
}

describe("同期の畳みを伝える", () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true })
    fs.mkdirSync(TEST_LOCAL_DIR, { recursive: true })
    sentToRenderer.length = 0
    capturedOnAfterSync = undefined
    mockRecordAuditLog.mockClear()
    saveSyncConfig(DEFAULT_SYNC_CONFIG)
  })

  afterEach(async () => {
    await stopSync()
    for (const dir of [TEST_DATA_DIR, TEST_LOCAL_DIR]) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  it("畳みが起きたら renderer へそのまま押し出す", async () => {
    const onAfterSync = await startWithCapturedCallback()
    const folds: SyncRecordFold[] = [
      {
        tableName: "ExamStudent",
        losingId: "losing-1",
        winningId: "winning-1",
        removedLocalRow: true,
        movedChildren: 0,
        lostChildren: 0,
      },
    ]

    onAfterSync(null, syncResultWithFolds(folds))

    const foldMessages = sentToRenderer.filter(
      (message) => message.channel === "sync:records-folded"
    )
    expect(foldMessages).toHaveLength(1)
    // main は加工しない（数え上げは renderer 側）
    expect(foldMessages[0].payload).toEqual(folds)
  })

  it("畳みが無い同期では押し出さないし記録もしない", async () => {
    const onAfterSync = await startWithCapturedCallback()

    onAfterSync(null, syncResultWithFolds([]))

    expect(
      sentToRenderer.filter(
        (message) => message.channel === "sync:records-folded"
      )
    ).toHaveLength(0)
    expect(mockRecordAuditLog).not.toHaveBeenCalled()
  })

  it("畳みを監査ログへ残す（消えた行が対象・操作者は null）", async () => {
    const onAfterSync = await startWithCapturedCallback()

    onAfterSync(
      null,
      syncResultWithFolds([
        {
          tableName: "ExamStudent",
          losingId: "losing-1",
          winningId: "winning-1",
          removedLocalRow: true,
          movedChildren: 0,
          lostChildren: 0,
        },
      ])
    )
    await waitForDetachedWrites()

    expect(mockRecordAuditLog).toHaveBeenCalledTimes(1)
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: "sync.merge",
      userId: null,
      entityType: "ExamStudent",
      entityId: "losing-1",
      target: "試験の受験生徒",
      extra: {
        losingId: "losing-1",
        winningId: "winning-1",
        removedLocalRow: true,
        movedChildren: 0,
        lostChildren: 0,
      },
      coalesceKey: "sync.merge:ExamStudent:losing-1",
    })
  })

  it("1回の同期で複数の行が畳まれたら、行ごとに記録する", async () => {
    const onAfterSync = await startWithCapturedCallback()

    onAfterSync(
      null,
      syncResultWithFolds([
        {
          tableName: "ExamStudent",
          losingId: "losing-1",
          winningId: "winning-1",
          removedLocalRow: true,
          movedChildren: 0,
          lostChildren: 0,
        },
        {
          tableName: "QuestionScore",
          losingId: "losing-2",
          winningId: "winning-2",
          removedLocalRow: false,
          movedChildren: 0,
          lostChildren: 0,
        },
      ])
    )
    await waitForDetachedWrites()

    expect(mockRecordAuditLog).toHaveBeenCalledTimes(2)
    // 呼び名を知らない表はテーブル名をそのまま出す
    expect(mockRecordAuditLog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entityType: "QuestionScore",
        entityId: "losing-2",
        target: "QuestionScore",
      })
    )
  })
})
