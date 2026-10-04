/**
 * 同期で見え方が変わった行を伝える経路のユニットテスト
 *
 * 伝えるものは2種類ある。ひとつは、別id・同一ユニークキーでかぶった行の片方が隠れる
 * （`SyncResult.folds`）・かぶりが解けて戻る（`SyncResult.restores`）こと。もうひとつは、
 * 他のPCで親を消されたために子が表から外れる（`SyncResult.parentDeleted`）・親が
 * 作り直されて戻る（`SyncResult.parentReturned`）ことである。どれも画面の上では
 * 黙って行が消えた・現れたように見える。
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
  getLocalDataDirectory: () => TEST_DATA_DIR,
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
      close: vi.fn().mockResolvedValue(undefined),
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

import {
  computeSharedRoots,
  fixStorageRoots,
} from "../../electron-src/lib/storageRoots"
import { saveSyncConfig } from "../../electron-src/lib/sync/syncConfig"
import { startSync, stopSync } from "../../electron-src/lib/sync/syncService"
import {
  DEFAULT_SYNC_CONFIG,
  type SyncParentDeleted,
  type SyncRecordFold,
} from "../../electron-src/lib/sync/types"

// 同期は共有モードで起動したときだけ動く
fixStorageRoots(
  computeSharedRoots(TEST_DATA_DIR, {
    sharedFolderId: "5f0c1a43-8f1e-4b8e-9d3c-2a9b6f1e7c10",
    sharedFolderPath: path.join(TEST_DATA_DIR, "shared-folder"),
  })
)

const FOLDS_CHANNEL = "sync:record-folds-changed"
const PARENT_DELETED_CHANNEL = "sync:parent-deleted-changed"

/**
 * 見え方が変わった行だけが載った同期結果（他の統計は使わないので0で埋める）。
 *
 * `folds` / `restores` / `parentDeleted` / `parentReturned` はライブラリの型では
 * どれも必須なので、省いた回を作らない（v0.21.0 で `restores` も必須になった）。
 */
const syncResultWith = ({
  folds = [],
  restores = [],
  parentDeleted = [],
  parentReturned = [],
}: {
  folds?: SyncRecordFold[]
  restores?: SyncRecordFold[]
  parentDeleted?: SyncParentDeleted[]
  parentReturned?: SyncParentDeleted[]
}) => ({
  clientsSynced: 1,
  inserted: 0,
  updated: 0,
  deleted: folds.length,
  skipped: 0,
  conflictsResolved: 0,
  folds,
  restores,
  parentDeleted,
  parentReturned,
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
    clientId: "test-client",
  }
  saveSyncConfig(config)
  await startSync(config)
  if (capturedOnAfterSync === undefined) {
    throw new Error("onAfterSync が setupSync に渡されていない")
  }
  return capturedOnAfterSync
}

const foldMessagesOf = () =>
  sentToRenderer.filter((message) => message.channel === FOLDS_CHANNEL)

const parentDeletedMessagesOf = () =>
  sentToRenderer.filter((message) => message.channel === PARENT_DELETED_CHANNEL)

describe("同期で見え方が変わった行を伝える", () => {
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

  it("隠れた行と戻った行を1回の押し出しにまとめて、そのまま renderer へ送る", async () => {
    const onAfterSync = await startWithCapturedCallback()
    const folds: SyncRecordFold[] = [
      {
        tableName: "ExamStudent",
        losingId: "losing-1",
        winningId: "winning-1",
      },
    ]
    const restores: SyncRecordFold[] = [
      { tableName: "Tag", losingId: "tag-2", winningId: "tag-1" },
    ]

    onAfterSync(null, syncResultWith({ folds, restores }))

    expect(foldMessagesOf()).toHaveLength(1)
    // main は加工しない（数え上げは renderer 側）
    expect(foldMessagesOf()[0].payload).toEqual({ folds, restores })
  })

  it("見え方の変わった行が無い同期では押し出さないし記録もしない", async () => {
    const onAfterSync = await startWithCapturedCallback()

    onAfterSync(null, syncResultWith({}))

    expect(foldMessagesOf()).toHaveLength(0)
    expect(parentDeletedMessagesOf()).toHaveLength(0)
    expect(mockRecordAuditLog).not.toHaveBeenCalled()
  })

  it("親の削除で外れた行と戻った行を1回の押し出しにまとめて、そのまま renderer へ送る", async () => {
    const onAfterSync = await startWithCapturedCallback()
    const parentDeleted: SyncParentDeleted[] = [
      {
        tableName: "QuestionScore",
        recordId: "score-1",
        content: { id: "score-1", examStudentId: "exam-student-1" },
        causeTable: "ExamStudent",
        causeId: "exam-student-1",
      },
    ]
    const parentReturned: SyncParentDeleted[] = [
      {
        tableName: "StudentAnswerImage",
        recordId: "image-1",
        content: { id: "image-1", examPageId: "exam-page-1" },
        causeTable: "ExamPage",
        causeId: "exam-page-1",
      },
    ]

    onAfterSync(null, syncResultWith({ parentDeleted, parentReturned }))

    expect(parentDeletedMessagesOf()).toHaveLength(1)
    // main は加工しない（数え上げは renderer 側）
    expect(parentDeletedMessagesOf()[0].payload).toEqual({
      parentDeleted,
      parentReturned,
    })
    // かぶりとは別の押し出しで、混ざらない
    expect(foldMessagesOf()).toHaveLength(0)
  })

  it("隠れた行を監査ログへ残す（隠れた行が対象・操作者は null・旧 sync.merge とは別の action）", async () => {
    const onAfterSync = await startWithCapturedCallback()

    onAfterSync(
      null,
      syncResultWith({
        folds: [
          {
            tableName: "ExamStudent",
            losingId: "losing-1",
            winningId: "winning-1",
          },
        ],
      })
    )
    await waitForDetachedWrites()

    expect(mockRecordAuditLog).toHaveBeenCalledTimes(1)
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: "sync.duplicate.hide",
      userId: null,
      entityType: "ExamStudent",
      entityId: "losing-1",
      target: "試験の受験生徒",
      extra: {
        losingId: "losing-1",
        winningId: "winning-1",
      },
      coalesceKey: "sync.duplicate.hide:ExamStudent:losing-1",
    })
  })

  it("表示に戻った行を監査ログへ残す（戻った行が対象）", async () => {
    const onAfterSync = await startWithCapturedCallback()

    onAfterSync(
      null,
      syncResultWith({
        restores: [{ tableName: "Tag", losingId: "tag-2", winningId: "tag-1" }],
      })
    )
    await waitForDetachedWrites()

    expect(mockRecordAuditLog).toHaveBeenCalledTimes(1)
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: "sync.duplicate.restore",
      userId: null,
      entityType: "Tag",
      entityId: "tag-2",
      target: "タグ",
      extra: {
        losingId: "tag-2",
        winningId: "tag-1",
      },
      coalesceKey: "sync.duplicate.restore:Tag:tag-2",
    })
  })

  it("1回の同期で複数の行が隠れたら、行ごとに記録する", async () => {
    const onAfterSync = await startWithCapturedCallback()

    onAfterSync(
      null,
      syncResultWith({
        folds: [
          {
            tableName: "ExamStudent",
            losingId: "losing-1",
            winningId: "winning-1",
          },
          {
            tableName: "AsbCharGuide",
            losingId: "losing-2",
            winningId: "winning-2",
          },
        ],
      })
    )
    await waitForDetachedWrites()

    expect(mockRecordAuditLog).toHaveBeenCalledTimes(2)
    // 呼び名を知らない表はテーブル名をそのまま出す
    expect(mockRecordAuditLog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entityType: "AsbCharGuide",
        entityId: "losing-2",
        target: "AsbCharGuide",
      })
    )
  })

  it("親の削除で外れた行を、削除された親1つにつき1行で監査ログへ残す（親が対象・操作者は null・束ねない）", async () => {
    const onAfterSync = await startWithCapturedCallback()

    onAfterSync(
      null,
      syncResultWith({
        parentDeleted: [
          {
            tableName: "QuestionScore",
            recordId: "score-1",
            content: { id: "score-1", examStudentId: "exam-student-1" },
            causeTable: "ExamStudent",
            causeId: "exam-student-1",
          },
          {
            tableName: "QuestionScore",
            recordId: "score-2",
            content: { id: "score-2", examStudentId: "exam-student-1" },
            causeTable: "ExamStudent",
            causeId: "exam-student-1",
          },
        ],
      })
    )
    await waitForDetachedWrites()

    expect(mockRecordAuditLog).toHaveBeenCalledTimes(1)
    // coalesceKey を持たない（後から届いた行の一覧を捨てない）ことも引数全体で確かめる
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: "sync.parent_deleted.hide",
      userId: null,
      entityType: "ExamStudent",
      entityId: "exam-student-1",
      target: "試験の受験生徒",
      extra: {
        causeTable: "ExamStudent",
        causeId: "exam-student-1",
        count: 2,
        countByTable: { QuestionScore: 2 },
        records: [
          { tableName: "QuestionScore", recordId: "score-1" },
          { tableName: "QuestionScore", recordId: "score-2" },
        ],
      },
    })
  })

  it("同じ親の子が複数の表にまたがるとき、表ごとに数える", async () => {
    const onAfterSync = await startWithCapturedCallback()

    onAfterSync(
      null,
      syncResultWith({
        parentDeleted: [
          {
            tableName: "QuestionScore",
            recordId: "score-1",
            content: { id: "score-1" },
            causeTable: "ExamStudent",
            causeId: "exam-student-1",
          },
          {
            tableName: "StudentAnswerImage",
            recordId: "image-1",
            content: { id: "image-1" },
            causeTable: "ExamStudent",
            causeId: "exam-student-1",
          },
          {
            tableName: "QuestionScore",
            recordId: "score-2",
            content: { id: "score-2" },
            causeTable: "ExamStudent",
            causeId: "exam-student-1",
          },
        ],
      })
    )
    await waitForDetachedWrites()

    expect(mockRecordAuditLog).toHaveBeenCalledTimes(1)
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        extra: expect.objectContaining({
          count: 3,
          countByTable: { QuestionScore: 2, StudentAnswerImage: 1 },
        }),
      })
    )
  })

  it("削除された親が2つなら、親ごとに2行で記録する", async () => {
    const onAfterSync = await startWithCapturedCallback()

    onAfterSync(
      null,
      syncResultWith({
        parentDeleted: [
          {
            tableName: "QuestionScore",
            recordId: "score-1",
            content: { id: "score-1" },
            causeTable: "ExamStudent",
            causeId: "exam-student-1",
          },
          {
            tableName: "StudentAnswerImage",
            recordId: "image-1",
            content: { id: "image-1" },
            causeTable: "ExamPage",
            causeId: "exam-page-1",
          },
          {
            tableName: "QuestionScore",
            recordId: "score-2",
            content: { id: "score-2" },
            causeTable: "ExamStudent",
            causeId: "exam-student-1",
          },
        ],
      })
    )
    await waitForDetachedWrites()

    expect(mockRecordAuditLog).toHaveBeenCalledTimes(2)
    expect(mockRecordAuditLog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        entityType: "ExamStudent",
        entityId: "exam-student-1",
        extra: expect.objectContaining({
          count: 2,
          records: [
            { tableName: "QuestionScore", recordId: "score-1" },
            { tableName: "QuestionScore", recordId: "score-2" },
          ],
        }),
      })
    )
    expect(mockRecordAuditLog).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        entityType: "ExamPage",
        entityId: "exam-page-1",
        extra: expect.objectContaining({
          count: 1,
          records: [{ tableName: "StudentAnswerImage", recordId: "image-1" }],
        }),
      })
    )
  })

  it("親が作り直されて戻った行を、戻ったことを示す action で監査ログへ残す", async () => {
    const onAfterSync = await startWithCapturedCallback()

    onAfterSync(
      null,
      syncResultWith({
        parentReturned: [
          {
            tableName: "QuestionScore",
            recordId: "score-1",
            content: { id: "score-1", examStudentId: "exam-student-1" },
            causeTable: "ExamStudent",
            causeId: "exam-student-1",
          },
        ],
      })
    )
    await waitForDetachedWrites()

    expect(mockRecordAuditLog).toHaveBeenCalledTimes(1)
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: "sync.parent_deleted.restore",
      userId: null,
      entityType: "ExamStudent",
      entityId: "exam-student-1",
      target: "試験の受験生徒",
      extra: {
        causeTable: "ExamStudent",
        causeId: "exam-student-1",
        count: 1,
        countByTable: { QuestionScore: 1 },
        records: [{ tableName: "QuestionScore", recordId: "score-1" }],
      },
    })
  })
})
