/**
 * 統合アーカイブ（.sao）の書き出しと下見を、main の外（作業者）で行うための仕事の受け渡し
 *
 * 範囲の計算と DB の書き出しは better-sqlite3 の同期処理で、main で行うとその間アプリ全体が
 * 止まる。そこで main は依頼を作業者（`unifiedArchiveExportWorker.ts`）へ送り、作業者は
 * ここの `runArchiveExportJob` で仕事をして、進捗・結果・失敗を送り返す。
 *
 * やり取りは構造化複製で運ぶので、例外はそのままでは渡らない。`ArchiveScopeError` は外せない
 * 理由（violations）ごと運び、main で同じ例外に戻す（`archiveExportJobErrorOf`）。
 *
 * electron には依存しない（作業者の入り口だけが electron の parentPort をつなぐ）。
 */

import {
  previewUnifiedArchiveExport,
  type PreviewUnifiedArchiveExportOptions,
  type UnifiedArchiveExportPreview,
} from "./archiveExportPreview"
import { ArchiveScopeError } from "./archiveScopeResolver"
import {
  createUnifiedArchive,
  type CreateUnifiedArchiveOptions,
  type UnifiedArchiveExportPhase,
  type UnifiedArchiveExportResult,
} from "./unifiedArchiveCreator"

/** 作業者へ渡す書き出しの指定（関数は運べないので、進捗は送り返しで受ける） */
export type ArchiveExportJobOptions = Omit<
  CreateUnifiedArchiveOptions,
  "onProgress" | "now"
>

export type ArchiveExportJob =
  | { kind: "export"; options: ArchiveExportJobOptions }
  | { kind: "preview"; options: PreviewUnifiedArchiveExportOptions }

/** main → 作業者 */
export interface ArchiveExportWorkerRequest {
  requestId: string
  job: ArchiveExportJob
}

/** 運べる形にした失敗 */
type ArchiveExportJobError =
  | {
      kind: "scope"
      message: string
      violations: ArchiveScopeError["violations"]
    }
  | { kind: "other"; message: string; stack: string | null }

/** 作業者 → main。`progress` と `heartbeat` は途中、それ以外は依頼1つにつき1回だけ届く */
export type ArchiveExportWorkerResponse =
  | { requestId: string; kind: "progress"; phase: UnifiedArchiveExportPhase }
  | { requestId: string; kind: "heartbeat" }
  | { requestId: string; kind: "exported"; result: UnifiedArchiveExportResult }
  | {
      requestId: string
      kind: "previewed"
      preview: UnifiedArchiveExportPreview
    }
  | { requestId: string; kind: "failed"; error: ArchiveExportJobError }

/**
 * 仕事の途中で生きていることを知らせる間隔。同期処理の間は届かないが、ZIP 詰めのように
 * 長くかかりうる非同期の段の間は届くので、main は「長いだけ」と「止まった」を見分けられる
 */
const ARCHIVE_EXPORT_HEARTBEAT_INTERVAL_MS = 5_000

const toJobError = (error: unknown): ArchiveExportJobError => {
  if (error instanceof ArchiveScopeError) {
    return {
      kind: "scope",
      message: error.message,
      violations: error.violations,
    }
  }
  if (error instanceof Error) {
    return { kind: "other", message: error.message, stack: error.stack ?? null }
  }
  return { kind: "other", message: String(error), stack: null }
}

/** 運ばれてきた失敗を、main で投げる例外に戻す */
export const archiveExportJobErrorOf = (
  jobError: ArchiveExportJobError
): Error => {
  if (jobError.kind === "scope") {
    return new ArchiveScopeError(jobError.message, jobError.violations)
  }
  const error = new Error(jobError.message)
  if (jobError.stack !== null) error.stack = jobError.stack
  return error
}

/** 依頼を1つこなし、進捗・生存の知らせ・結果か失敗を `post` で送る。自身は投げない */
export async function runArchiveExportJob(
  request: ArchiveExportWorkerRequest,
  post: (response: ArchiveExportWorkerResponse) => void,
  heartbeatIntervalMs: number = ARCHIVE_EXPORT_HEARTBEAT_INTERVAL_MS
): Promise<void> {
  const { requestId, job } = request
  const heartbeat = setInterval(
    () => post({ requestId, kind: "heartbeat" }),
    heartbeatIntervalMs
  )
  try {
    if (job.kind === "export") {
      const result = await createUnifiedArchive({
        ...job.options,
        onProgress: (phase) => post({ requestId, kind: "progress", phase }),
      })
      post({ requestId, kind: "exported", result })
    } else {
      const preview = previewUnifiedArchiveExport(job.options)
      post({ requestId, kind: "previewed", preview })
    }
  } catch (error) {
    post({ requestId, kind: "failed", error: toJobError(error) })
  } finally {
    clearInterval(heartbeat)
  }
}
