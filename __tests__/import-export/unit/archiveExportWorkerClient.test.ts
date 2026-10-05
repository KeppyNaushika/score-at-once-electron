/**
 * 統合アーカイブの書き出し・下見を作業者へ頼む窓口
 *
 * テスト対象:
 * - electron-src/lib/export/unified-archive/archiveExportWorkerClient.ts
 * - electron-src/lib/export/unified-archive/archiveExportJob.ts（失敗の運び方）
 *
 * 作業者（utilityProcess）はテストでは起こせないので、依頼を溜めて返事を手で返す偽物を渡し、
 * 順番・進捗の振り分け・作業者が落ちた／黙った／暇になったときの扱いを見る。
 */

import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  type ArchiveExportWorkerRequest,
  type ArchiveExportWorkerResponse,
  runArchiveExportJob,
} from "../../../electron-src/lib/export/unified-archive/archiveExportJob"
import type { UnifiedArchiveExportPreview } from "../../../electron-src/lib/export/unified-archive/archiveExportPreview"
import {
  type ArchiveExportWorkerProcess,
  createArchiveExportWorkerClient,
} from "../../../electron-src/lib/export/unified-archive/archiveExportWorkerClient"
import { ArchiveScopeError } from "../../../electron-src/lib/export/unified-archive/archiveScopeResolver"
import type { UnifiedArchiveExportResult } from "../../../electron-src/lib/export/unified-archive/unifiedArchiveCreator"
import {
  UNIFIED_ARCHIVE_FORMAT,
  UNIFIED_ARCHIVE_FORMAT_VERSION,
} from "../../../src/types/unifiedArchive.types"

/** 依頼を溜め、返事・終了を手で起こせる作業者の偽物 */
interface FakeWorker extends ArchiveExportWorkerProcess {
  readonly requests: ArchiveExportWorkerRequest[]
  readonly killed: () => boolean
  respond: (response: ArchiveExportWorkerResponse) => void
  exit: (code: number) => void
}

const createFakeWorker = (): FakeWorker => {
  const requests: ArchiveExportWorkerRequest[] = []
  const messageListeners: ((response: ArchiveExportWorkerResponse) => void)[] =
    []
  const exitListeners: ((code: number) => void)[] = []
  let killed = false
  return {
    requests,
    killed: () => killed,
    postMessage: (request) => {
      requests.push(request)
    },
    onMessage: (listener) => {
      messageListeners.push(listener)
    },
    onExit: (listener) => {
      exitListeners.push(listener)
    },
    kill: () => {
      killed = true
    },
    respond: (response) =>
      messageListeners.forEach((listener) => listener(response)),
    exit: (code) => exitListeners.forEach((listener) => listener(code)),
  }
}

const EXPORT_OPTIONS = {
  sourceDatabasePath: "/source.db",
  dataDirectory: "/data",
  outputPath: "/out.sao.partial",
  selection: { roots: {} },
  exportedByUserId: null,
  appVersion: "0.0.0-test",
}

const PREVIEW_OPTIONS = {
  sourceDatabasePath: "/source.db",
  dataDirectory: "/data",
  selection: { roots: {} },
}

const exportResult = (outputPath: string): UnifiedArchiveExportResult => ({
  outputPath,
  manifest: {
    format: UNIFIED_ARCHIVE_FORMAT,
    formatVersion: UNIFIED_ARCHIVE_FORMAT_VERSION,
    appVersion: "0.0.0-test",
    lastMigration: null,
    exportedAt: "2026-10-05T00:00:00.000Z",
    exportedByUserId: null,
    selection: {
      roots: {},
      shared: {},
      scoring: { kind: "all" },
      includeAnswers: true,
      optionalItems: [],
    },
    exclusions: { requested: {}, excludedRowCounts: {} },
    rowCounts: {},
    files: { count: 0, missing: [] },
  },
})

const emptyPreview: UnifiedArchiveExportPreview = {
  kind: "ok",
  rowCounts: {},
  excludedRowCounts: {},
  entityIds: {
    Exam: [],
    Coursework: [],
    Grade: [],
    AsbDefinition: [],
    Student: [],
    Classroom: [],
    SubtotalGroup: [],
    Tag: [],
    User: [],
  },
  forcedBy: {},
  missingFiles: [],
}

describe("書き出しの作業者の窓口", () => {
  let workers: FakeWorker[]
  const spawn = (): FakeWorker => {
    const worker = createFakeWorker()
    workers.push(worker)
    return worker
  }
  const createClient = () =>
    createArchiveExportWorkerClient({
      spawn,
      silenceLimitMs: 1_000,
      idleLimitMs: 5_000,
      exitWaitLimitMs: 2_000,
    })

  beforeEach(() => {
    workers = []
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("依頼は1つずつ送り、進捗はその依頼の書き出しへ届け、作業者は使い回す", async () => {
    const client = createClient()
    const firstProgress = vi.fn()
    const secondProgress = vi.fn()
    const first = client.exportArchive(EXPORT_OPTIONS, firstProgress)
    const second = client.exportArchive(
      { ...EXPORT_OPTIONS, outputPath: "/second.sao.partial" },
      secondProgress
    )

    expect(workers).toHaveLength(1)
    const [worker] = workers
    // 前が終わるまで次は送らない
    expect(worker.requests).toHaveLength(1)
    const [firstRequest] = worker.requests
    expect(firstRequest.job).toEqual({
      kind: "export",
      options: EXPORT_OPTIONS,
    })

    worker.respond({
      requestId: firstRequest.requestId,
      kind: "progress",
      phase: "resolvingScope",
    })
    worker.respond({
      requestId: firstRequest.requestId,
      kind: "exported",
      result: exportResult("/out.sao.partial"),
    })
    await expect(first).resolves.toEqual(exportResult("/out.sao.partial"))
    expect(firstProgress).toHaveBeenCalledWith("resolvingScope")

    expect(worker.requests).toHaveLength(2)
    const secondRequest = worker.requests[1]
    // 前の依頼宛ての遅れた返事は捨てる
    worker.respond({
      requestId: firstRequest.requestId,
      kind: "progress",
      phase: "packing",
    })
    worker.respond({
      requestId: secondRequest.requestId,
      kind: "progress",
      phase: "writingDatabase",
    })
    worker.respond({
      requestId: secondRequest.requestId,
      kind: "exported",
      result: exportResult("/second.sao.partial"),
    })
    await expect(second).resolves.toEqual(exportResult("/second.sao.partial"))
    expect(firstProgress).toHaveBeenCalledTimes(1)
    expect(secondProgress).toHaveBeenCalledExactlyOnceWith("writingDatabase")
    expect(workers).toHaveLength(1)
  })

  it("運ばれてきた ArchiveScopeError は、外せない理由ごと同じ例外に戻して投げる", async () => {
    const client = createClient()
    const exporting = client.exportArchive(EXPORT_OPTIONS, () => {})
    const [worker] = workers
    const violations = [
      {
        table: "GradeDataSource",
        id: "ds1",
        column: "examId",
        target: "Exam(e1)",
      },
    ]
    worker.respond({
      requestId: worker.requests[0].requestId,
      kind: "failed",
      error: { kind: "scope", message: "外せません", violations },
    })
    await expect(exporting).rejects.toBeInstanceOf(ArchiveScopeError)
    await expect(exporting).rejects.toMatchObject({
      message: "外せません",
      violations,
    })
  })

  it("作業者が途中で終わったらその依頼は失敗にし、次の依頼は新しい作業者で続ける", async () => {
    const client = createClient()
    const exporting = client.exportArchive(EXPORT_OPTIONS, () => {})
    const previewing = client.previewExport(PREVIEW_OPTIONS)
    workers[0].exit(1)

    await expect(exporting).rejects.toThrow(
      "書き出しの作業者が途中で終了しました（終了コード 1）"
    )
    expect(workers).toHaveLength(2)
    const [previewRequest] = workers[1].requests
    expect(previewRequest.job.kind).toBe("preview")
    workers[1].respond({
      requestId: previewRequest.requestId,
      kind: "previewed",
      preview: emptyPreview,
    })
    await expect(previewing).resolves.toEqual(emptyPreview)
  })

  it("何も届かないまま上限を過ぎたら作業者を終わらせ、終わったのを見届けてから失敗にする", async () => {
    const client = createClient()
    const exporting = client.exportArchive(EXPORT_OPTIONS, () => {})
    const settled = vi.fn()
    exporting.catch(settled)
    const [worker] = workers

    // 生存の知らせが届く間は待つ
    await vi.advanceTimersByTimeAsync(800)
    worker.respond({
      requestId: worker.requests[0].requestId,
      kind: "heartbeat",
    })
    await vi.advanceTimersByTimeAsync(800)
    expect(worker.killed()).toBe(false)

    await vi.advanceTimersByTimeAsync(300)
    expect(worker.killed()).toBe(true)
    // 終わるまでは失敗にしない（呼び出し側が作りかけを消すのは、作業者が書かなくなってから）
    expect(settled).not.toHaveBeenCalled()
    worker.exit(0)
    await expect(exporting).rejects.toThrow("応答しないため止めました")
  })

  it("終わらせた作業者が終わらなくても、待つ上限で失敗にして次へ進む", async () => {
    const client = createClient()
    const exporting = client.exportArchive(EXPORT_OPTIONS, () => {})
    exporting.catch(() => {})
    const previewing = client.previewExport(PREVIEW_OPTIONS)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(workers[0].killed()).toBe(true)
    expect(workers).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(2_000)
    await expect(exporting).rejects.toThrow("応答しないため止めました")
    expect(workers).toHaveLength(2)
    workers[1].respond({
      requestId: workers[1].requests[0].requestId,
      kind: "previewed",
      preview: emptyPreview,
    })
    await expect(previewing).resolves.toEqual(emptyPreview)
  })

  it("仕事が無いまましばらく経ったら作業者を終わらせ、次の依頼で起こし直す", async () => {
    const client = createClient()
    const previewing = client.previewExport(PREVIEW_OPTIONS)
    workers[0].respond({
      requestId: workers[0].requests[0].requestId,
      kind: "previewed",
      preview: emptyPreview,
    })
    await previewing

    await vi.advanceTimersByTimeAsync(5_000)
    expect(workers[0].killed()).toBe(true)
    // 休ませた作業者の終わりは失敗として数えない
    workers[0].exit(0)

    void client.previewExport(PREVIEW_OPTIONS)
    expect(workers).toHaveLength(2)
    expect(workers[1].requests).toHaveLength(1)
  })

  it("作業者を起こせなければその依頼を失敗にする", async () => {
    const client = createArchiveExportWorkerClient({
      spawn: () => {
        throw new Error("起こせません")
      },
    })
    await expect(client.previewExport(PREVIEW_OPTIONS)).rejects.toThrow(
      "起こせません"
    )
  })

  it("終了時は作業者を終わらせ、終わっていない依頼を全て失敗にする", async () => {
    const client = createClient()
    const exporting = client.exportArchive(EXPORT_OPTIONS, () => {})
    const previewing = client.previewExport(PREVIEW_OPTIONS)
    client.shutdown()

    expect(workers[0].killed()).toBe(true)
    await expect(exporting).rejects.toThrow("アプリを終了するため")
    await expect(previewing).rejects.toThrow("アプリを終了するため")
  })
})

describe("作業者の中身（runArchiveExportJob）", () => {
  it("失敗は投げずに、運べる形にして返す", async () => {
    const responses: ArchiveExportWorkerResponse[] = []
    await runArchiveExportJob(
      {
        requestId: "r1",
        job: {
          kind: "preview",
          options: {
            ...PREVIEW_OPTIONS,
            sourceDatabasePath: path.join(
              os.tmpdir(),
              "archive-export-job-missing",
              "source.db"
            ),
          },
        },
      },
      (response) => responses.push(response)
    )
    expect(responses).toEqual([
      {
        requestId: "r1",
        kind: "failed",
        error: {
          kind: "other",
          message: expect.any(String),
          stack: expect.any(String),
        },
      },
    ])
  })
})
