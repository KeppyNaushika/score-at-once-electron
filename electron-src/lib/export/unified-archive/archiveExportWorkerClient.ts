/**
 * main から統合アーカイブ（.sao）の書き出し・下見を作業者へ頼む窓口
 *
 * - 依頼は届いた順に1つずつ作業者へ送る。書き出しを2つ続けて押しても、下見が重なっても、
 *   前のものが終わってから次が始まる（作業者は同期処理の間ほかの依頼を受けられないので、
 *   並べて送っても速くはならない）
 * - 作業者は最初の依頼で起こし、仕事が無いまましばらく経ったら終わらせる
 * - 作業者が途中で終わったら、その依頼は失敗にする。何も届かないまま `silenceLimitMs` 経ったら
 *   応答しないとみなして終わらせ、終わったのを見届けてから失敗にする（呼び出し側が作りかけを
 *   消すとき、作業者がまだ書いていないように）。どちらでも、次の依頼は新しい作業者で続ける
 *
 * 作業者の起こし方（Electron の utilityProcess）は `spawn` で受け、ここは electron に依存しない。
 */

import * as crypto from "crypto"

import {
  type ArchiveExportJob,
  archiveExportJobErrorOf,
  type ArchiveExportJobOptions,
  type ArchiveExportWorkerRequest,
  type ArchiveExportWorkerResponse,
} from "./archiveExportJob"
import type {
  PreviewUnifiedArchiveExportOptions,
  UnifiedArchiveExportPreview,
} from "./archiveExportPreview"
import type {
  UnifiedArchiveExportPhase,
  UnifiedArchiveExportResult,
} from "./unifiedArchiveCreator"

/** 起こした作業者1つ。Electron の UtilityProcess を包んで渡す */
export interface ArchiveExportWorkerProcess {
  postMessage: (request: ArchiveExportWorkerRequest) => void
  onMessage: (listener: (response: ArchiveExportWorkerResponse) => void) => void
  onExit: (listener: (code: number) => void) => void
  kill: () => void
}

interface ArchiveExportWorkerClientOptions {
  spawn: () => ArchiveExportWorkerProcess
  /** 仕事中の作業者から何も届かないまま、これだけ経ったら応答しないとみなす */
  silenceLimitMs?: number
  /** 仕事が無いまま、これだけ経ったら作業者を終わらせる */
  idleLimitMs?: number
  /** 終わらせた作業者の終わりを待つ上限。過ぎたら終わったものとして扱う */
  exitWaitLimitMs?: number
}

interface ArchiveExportWorkerClient {
  exportArchive: (
    options: ArchiveExportJobOptions,
    onProgress: (phase: UnifiedArchiveExportPhase) => void
  ) => Promise<UnifiedArchiveExportResult>
  previewExport: (
    options: PreviewUnifiedArchiveExportOptions
  ) => Promise<UnifiedArchiveExportPreview>
  /** 作業者を終わらせ、終わっていない依頼を全て失敗にする（アプリの終了時） */
  shutdown: () => void
}

/** 同期処理の間は生存の知らせも届かない。64MB の DB で約1秒なので、桁違いに余裕を持たせる */
const DEFAULT_SILENCE_LIMIT_MS = 5 * 60_000
const DEFAULT_IDLE_LIMIT_MS = 60_000
const DEFAULT_EXIT_WAIT_LIMIT_MS = 10_000

/** 依頼1つの、終わりの知らせ（途中の知らせを除いたもの） */
type ArchiveExportJobOutcome = Exclude<
  ArchiveExportWorkerResponse,
  { kind: "progress" } | { kind: "heartbeat" }
>

interface PendingJob {
  readonly request: ArchiveExportWorkerRequest
  readonly onProgress: ((phase: UnifiedArchiveExportPhase) => void) | null
  readonly resolve: (outcome: ArchiveExportJobOutcome) => void
  readonly reject: (error: Error) => void
}

const unexpectedOutcomeError = (
  expected: ArchiveExportJobOutcome["kind"],
  outcome: ArchiveExportJobOutcome
): Error =>
  new Error(
    `書き出しの作業者から想定外の返事が届きました（${expected} を待っていたところに ${outcome.kind}）`
  )

export function createArchiveExportWorkerClient(
  options: ArchiveExportWorkerClientOptions
): ArchiveExportWorkerClient {
  const silenceLimitMs = options.silenceLimitMs ?? DEFAULT_SILENCE_LIMIT_MS
  const idleLimitMs = options.idleLimitMs ?? DEFAULT_IDLE_LIMIT_MS
  const exitWaitLimitMs = options.exitWaitLimitMs ?? DEFAULT_EXIT_WAIT_LIMIT_MS

  const queue: PendingJob[] = []
  let worker: ArchiveExportWorkerProcess | null = null
  let current: PendingJob | null = null
  /** 作業者を終わらせ、終わるのを待っている間は次を始めない */
  let waitingForExit = false
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  const clearSilenceTimer = (): void => {
    if (silenceTimer !== null) clearTimeout(silenceTimer)
    silenceTimer = null
  }
  const clearIdleTimer = (): void => {
    if (idleTimer !== null) clearTimeout(idleTimer)
    idleTimer = null
  }

  const armIdleTimer = (): void => {
    clearIdleTimer()
    if (worker === null) return
    const idleWorker = worker
    idleTimer = setTimeout(() => {
      idleTimer = null
      if (worker !== idleWorker || current !== null) return
      worker = null
      idleWorker.kill()
    }, idleLimitMs)
  }

  /**
   * 今の作業者を手放す。仕事中の依頼は、作業者が終わったのを見届けてから（待ちきれなければ
   * 上限で）`error` で失敗にし、次へ進む
   */
  const abandonWorker = (
    abandoned: ArchiveExportWorkerProcess,
    error: Error,
    alreadyExited: boolean
  ): void => {
    if (worker !== abandoned) return
    worker = null
    clearSilenceTimer()
    clearIdleTimer()
    const failedJob = current
    current = null

    let settled = false
    const settle = (): void => {
      if (settled) return
      settled = true
      waitingForExit = false
      failedJob?.reject(error)
      pump()
    }
    if (alreadyExited) {
      settle()
      return
    }
    waitingForExit = true
    abandoned.onExit(settle)
    setTimeout(settle, exitWaitLimitMs)
    abandoned.kill()
  }

  const armSilenceTimer = (activeWorker: ArchiveExportWorkerProcess): void => {
    clearSilenceTimer()
    silenceTimer = setTimeout(() => {
      silenceTimer = null
      abandonWorker(
        activeWorker,
        new Error(
          `書き出しの作業者が ${Math.round(silenceLimitMs / 1000)} 秒応答しないため止めました`
        ),
        false
      )
    }, silenceLimitMs)
  }

  const handleResponse = (
    respondingWorker: ArchiveExportWorkerProcess,
    response: ArchiveExportWorkerResponse
  ): void => {
    if (respondingWorker !== worker || current === null) return
    if (response.requestId !== current.request.requestId) return
    armSilenceTimer(respondingWorker)
    if (response.kind === "heartbeat") return
    if (response.kind === "progress") {
      current.onProgress?.(response.phase)
      return
    }
    clearSilenceTimer()
    const finishedJob = current
    current = null
    finishedJob.resolve(response)
    pump()
  }

  const spawnWorker = (): ArchiveExportWorkerProcess => {
    const spawned = options.spawn()
    spawned.onMessage((response) => handleResponse(spawned, response))
    spawned.onExit((code) =>
      abandonWorker(
        spawned,
        new Error(`書き出しの作業者が途中で終了しました（終了コード ${code}）`),
        true
      )
    )
    return spawned
  }

  /** 仕事中でなければ、待っている次の依頼を作業者へ送る。何も無ければ作業者を休ませる */
  const pump = (): void => {
    if (current !== null || waitingForExit) return
    const nextJob = queue.shift()
    if (!nextJob) {
      armIdleTimer()
      return
    }
    clearIdleTimer()
    let activeWorker: ArchiveExportWorkerProcess
    try {
      activeWorker = worker ?? spawnWorker()
    } catch (error) {
      nextJob.reject(
        error instanceof Error
          ? error
          : new Error(`書き出しの作業者を起こせませんでした: ${String(error)}`)
      )
      pump()
      return
    }
    worker = activeWorker
    current = nextJob
    armSilenceTimer(activeWorker)
    try {
      activeWorker.postMessage(nextJob.request)
    } catch (error) {
      abandonWorker(
        activeWorker,
        error instanceof Error
          ? error
          : new Error(
              `書き出しの作業者へ依頼を送れませんでした: ${String(error)}`
            ),
        false
      )
    }
  }

  const enqueue = (
    job: ArchiveExportJob,
    onProgress: ((phase: UnifiedArchiveExportPhase) => void) | null
  ): Promise<ArchiveExportJobOutcome> =>
    new Promise((resolve, reject) => {
      queue.push({
        request: { requestId: crypto.randomUUID(), job },
        onProgress,
        resolve,
        reject,
      })
      pump()
    })

  return {
    exportArchive: async (jobOptions, onProgress) => {
      const outcome = await enqueue(
        { kind: "export", options: jobOptions },
        onProgress
      )
      if (outcome.kind === "exported") return outcome.result
      if (outcome.kind === "failed")
        throw archiveExportJobErrorOf(outcome.error)
      throw unexpectedOutcomeError("exported", outcome)
    },

    previewExport: async (previewOptions) => {
      const outcome = await enqueue(
        { kind: "preview", options: previewOptions },
        null
      )
      if (outcome.kind === "previewed") return outcome.preview
      if (outcome.kind === "failed")
        throw archiveExportJobErrorOf(outcome.error)
      throw unexpectedOutcomeError("previewed", outcome)
    },

    shutdown: () => {
      const stopping = new Error("アプリを終了するため書き出しを中止しました")
      const pendingJobs = [...(current ? [current] : []), ...queue]
      queue.length = 0
      current = null
      clearSilenceTimer()
      clearIdleTimer()
      const stoppingWorker = worker
      worker = null
      stoppingWorker?.kill()
      for (const pendingJob of pendingJobs) pendingJob.reject(stopping)
    },
  }
}
