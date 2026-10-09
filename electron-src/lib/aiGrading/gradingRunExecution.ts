/**
 * 採点の run の送り方ごとの処理（その場の採点・バッチの預け入れ）。
 *
 * どちらも試行の依頼の組み方（`buildRequest`）と進み具合（`tracker`）を受け取り、
 * 結果を試行へ書いて run の状態を進める。run を作るのと中止の口は `gradingJobRunner.ts`。
 */

import type { Stage1ValidationContext } from "@/lib/shared/aiGrading/stage1ResponseValidator"

import {
  closePendingAiGradingAttempts,
  recordAiGradingAttemptResult,
  updateAiGradingRun,
} from "../prisma/aiGradingRun"
import { toAttemptResult, toFailedAttemptResult } from "./gradingRequestFactory"
import { GradingProviderError } from "./providers/providerShared"
import type { GradingProvider, GradingRequest } from "./providers/types"
import type { createRunProgressTracker } from "./runProgressTracker"

/** 試行のうち、依頼を組むのに要るもの */
interface PendingAttempt {
  id: string
  examStudentId: string
}

interface RunExecutionInput {
  runId: string
  attempts: readonly PendingAttempt[]
  provider: GradingProvider
  /** 試行1件の依頼を組む（答案の画像を切り出す） */
  buildRequest: (attempt: PendingAttempt) => Promise<GradingRequest>
  tracker: ReturnType<typeof createRunProgressTracker>
}

/** 同時に走らせる数を絞る（空きが出たら待っている次の1件へ枠をそのまま渡す） */
export function createConcurrencyLimiter(limit: number) {
  let activeCount = 0
  const waitingStarts: (() => void)[] = []
  return async function runLimited(task: () => Promise<void>): Promise<void> {
    if (activeCount < limit) {
      activeCount += 1
    } else {
      await new Promise<void>((resolve) => waitingStarts.push(resolve))
    }
    try {
      await task()
    } finally {
      const nextStart = waitingStarts.shift()
      if (nextStart) nextStart()
      else activeCount -= 1
    }
  }
}

/** 認証・権限の失敗（run 全体を止めるもの）か */
function isFatalProviderError(error: unknown): error is GradingProviderError {
  return (
    error instanceof GradingProviderError &&
    (error.kind === "authentication" || error.kind === "permission")
  )
}

export const errorMessageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * その場の採点。同時実行数を絞って送り、届いた結果から順に書く。
 *
 * 中止（`controller.abort()`）されたら送信中の呼び出しを打ち切り、結果待ちの試行を
 * 「中止」で閉じる。認証・権限の失敗は run 全体を止める。
 */
export async function processRealtimeAttempts(
  input: RunExecutionInput & {
    controller: AbortController
    concurrency: number
    /** 応答の検証に使う、送ったときの配点と項目の id */
    validationContext: Stage1ValidationContext
  }
): Promise<"ended" | "canceled" | "failed"> {
  const { runId, attempts, provider, buildRequest, tracker, controller } = input
  const { validationContext } = input
  const runLimited = createConcurrencyLimiter(Math.max(1, input.concurrency))
  // 閉包の中で書き換えるので、箱に入れて持つ（素の let だと型が null に絞られたままになる）
  const fatal: { error: GradingProviderError | null } = { error: null }

  const processAttempt = async (attempt: (typeof attempts)[number]) => {
    if (controller.signal.aborted) return
    let result
    try {
      const request = await buildRequest(attempt)
      // 画像を切り出している間に中止されたら送らない
      if (controller.signal.aborted) return
      const response = await provider.grade(request, controller.signal)
      result = toAttemptResult(response, validationContext)
    } catch (error) {
      if (isFatalProviderError(error)) {
        fatal.error = error
        controller.abort()
        return
      }
      // 中止で打ち切られた件は、後でまとめて「中止」として閉じる
      if (controller.signal.aborted) return
      result = toFailedAttemptResult("errored", errorMessageOf(error))
    }
    if (await recordAiGradingAttemptResult(attempt.id, result)) {
      tracker.record(result.state)
    }
  }

  // 最初の1件だけ先に送り、設問ごとの前置き（問題文・模範解答・採点基準）のキャッシュを
  // 作ってから残りを並行させる。最初から並行すると、キャッシュができる前に届いた数件が
  // それぞれ前置きを書き込みとして払う（模範解答の画像を含むので重い）
  const [firstAttempt, ...restAttempts] = attempts
  if (firstAttempt) await processAttempt(firstAttempt)
  await Promise.all(
    restAttempts.map((attempt) => runLimited(() => processAttempt(attempt)))
  )

  const fatalError = fatal.error
  const status = fatalError
    ? "failed"
    : controller.signal.aborted
      ? "canceled"
      : "ended"
  if (status !== "ended") {
    await closePendingAiGradingAttempts(
      runId,
      "errored",
      fatalError
        ? `送信を止めました: ${errorMessageOf(fatalError)}`
        : "中止しました"
    )
  }
  await updateAiGradingRun(runId, { status, endedAt: new Date() })
  tracker.finish(status)
  return status
}

/** バッチを預ける。画像を用意できなかった試行はその場で失敗にする。預けられなければ投げる */
export async function submitBatchAttempts(
  input: RunExecutionInput
): Promise<void> {
  const { runId, attempts, provider, buildRequest, tracker } = input
  const requests: GradingRequest[] = []
  for (const attempt of attempts) {
    try {
      requests.push(await buildRequest(attempt))
    } catch (error) {
      const result = toFailedAttemptResult("errored", errorMessageOf(error))
      if (await recordAiGradingAttemptResult(attempt.id, result)) {
        tracker.record(result.state)
      }
    }
  }
  try {
    if (requests.length === 0) throw new Error("送れる答案がありません")
    const { externalBatchId } = await provider.submitBatch(requests)
    await updateAiGradingRun(runId, {
      status: "in_progress",
      externalBatchId,
    })
    tracker.update("in_progress")
  } catch (error) {
    await closePendingAiGradingAttempts(
      runId,
      "errored",
      `バッチを預けられませんでした: ${errorMessageOf(error)}`
    )
    await updateAiGradingRun(runId, { status: "failed", endedAt: new Date() })
    tracker.finish("failed")
    throw error
  }
}
