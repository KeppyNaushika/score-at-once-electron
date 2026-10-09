/**
 * この端末が事業者へ預けたバッチの結果を回収する（docs/vlm-grading-design.md §10 batchPoller）。
 *
 * - 回収するのは `submittedClientId` がこの端末の run だけ（同じバッチを複数の端末が
 *   取り込んで、試行を二重に書かないため）
 * - 結果は custom_id（＝試行の id）で試行へ対応付け、まだ pending の試行にだけ書く
 * - 結果が返らなかった試行は期限切れ（expired）で閉じる（再送は画面から提案する）
 * - 取り込み終えたら、事業者側に残る預け物を消す（OpenAI のファイル。答案の画像を含む）
 * - 判定が1件でも出たら、そのまま2段目（項目の案）を続ける（`groupingRunner.ts`）
 *
 * 起動時と一定間隔で `pollOnce` を呼ぶのは `startBatchPolling`。
 */

import { parseRubricItemIds } from "@/lib/shared/aiGrading/rubricItemsText"

import {
  closePendingAiGradingAttempts,
  getAiGradingRunForProcessing,
  listBatchRunsToCollect,
  recordAiGradingAttemptResult,
  updateAiGradingRun,
} from "../prisma/aiGradingRun"
import { toAttemptResult } from "./gradingRequestFactory"
import { createGroupingRunner } from "./groupingRunner"
import type { AiGradingJobDependencies } from "./jobDependencies"
import { isGradingProviderId } from "./providers/types"
import { createRunProgressTracker } from "./runProgressTracker"

/** 回収を確かめる間隔の既定 */
const DEFAULT_POLL_INTERVAL_MS = 60_000

export function createBatchCollector(
  dependencies: AiGradingJobDependencies,
  groupingRunner: ReturnType<
    typeof createGroupingRunner
  > = createGroupingRunner(dependencies)
) {
  /** 前の回収が終わる前に次を始めない */
  let isPolling = false

  /** 1つの run を確かめ、終わっていれば取り込む */
  async function collectRun(runId: string): Promise<void> {
    const run = await getAiGradingRunForProcessing(runId)
    if (!run?.externalBatchId || run.status !== "in_progress") return
    if (!isGradingProviderId(run.provider)) return
    const provider = dependencies.resolveProvider(run.provider)
    const externalBatchId = run.externalBatchId

    const batchStatus = await provider.getBatchStatus(externalBatchId)
    if (batchStatus === "in_progress" || batchStatus === "canceling") return

    const tracker = createRunProgressTracker({
      runId: run.id,
      cropRegionId: run.prompt.cropRegionId,
      total: run.attempts.length,
      notifyProgress: dependencies.notifyProgress,
    })

    if (batchStatus === "failed") {
      await closePendingAiGradingAttempts(
        run.id,
        "errored",
        "バッチ全体が事業者に受け付けられませんでした"
      )
      await updateAiGradingRun(run.id, {
        status: "failed",
        endedAt: new Date(),
      })
      tracker.finish("failed")
      await cleanup()
      return
    }

    const pendingAttemptIds = new Set(
      run.attempts
        .filter((attempt) => attempt.state === "pending")
        .map((attempt) => attempt.id)
    )
    // 当てはまる項目は、送った一覧に載っていた id と照らす（回収までに項目が変わりうる）
    const validationContext = {
      maxPoints: run.points === null ? null : run.points.toNumber(),
      rubricItemIds: parseRubricItemIds(run.prompt.renderedRubricItems),
    }
    let succeededCount = run.attempts.filter(
      (attempt) => attempt.state === "succeeded"
    ).length
    for await (const batchResult of provider.readBatchResults(
      externalBatchId
    )) {
      if (!pendingAttemptIds.has(batchResult.customId)) continue
      const attemptResult = toAttemptResult(
        batchResult.response,
        validationContext
      )
      if (
        await recordAiGradingAttemptResult(batchResult.customId, attemptResult)
      ) {
        pendingAttemptIds.delete(batchResult.customId)
        if (attemptResult.state === "succeeded") succeededCount += 1
        tracker.record(attemptResult.state)
      }
    }

    await closePendingAiGradingAttempts(
      run.id,
      "expired",
      "結果が返りませんでした（期限切れ・取り消し）。送り直してください"
    )
    const status = succeededCount === 0 ? "expired" : "ended"
    await updateAiGradingRun(run.id, { status, endedAt: new Date() })
    tracker.finish(status)
    await cleanup()
    if (status === "ended" && run.purpose === "grade") {
      await groupingRunner.runGroupingAfterGrading(run.id, run.userId)
    }

    /** 事業者側の預け物を消す。失敗しても取り込みは済んでいるので記録だけ残す */
    async function cleanup(): Promise<void> {
      try {
        await provider.cleanupBatch?.(externalBatchId)
      } catch (error) {
        console.warn(
          `[aiGrading] 事業者側のバッチの預け物を消せませんでした: ${externalBatchId}`,
          error
        )
      }
    }
  }

  /**
   * この端末が預けて、まだ取り込んでいないバッチを1回ずつ確かめる。
   * run ごとの失敗（キーが無い・通信できない）は記録して次へ進む
   */
  async function pollOnce(): Promise<void> {
    if (isPolling) return
    isPolling = true
    try {
      const runs = await listBatchRunsToCollect(dependencies.getClientId())
      for (const run of runs) {
        try {
          await collectRun(run.id)
        } catch (error) {
          console.warn(
            `[aiGrading] バッチの回収に失敗しました: ${run.id}`,
            error
          )
        }
      }
    } finally {
      isPolling = false
    }
  }

  return { pollOnce }
}

/**
 * 起動時と一定間隔で回収する。止めるには戻り値を呼ぶ。
 *
 * @param shouldPoll 回収してよいか（同意もキーも無い端末では何もしない）
 */
export function startBatchPolling(
  collector: ReturnType<typeof createBatchCollector>,
  shouldPoll: () => boolean,
  intervalMs: number = DEFAULT_POLL_INTERVAL_MS
): () => void {
  const tick = () => {
    if (!shouldPoll()) return
    collector.pollOnce().catch((error: unknown) => {
      console.warn("[aiGrading] バッチの回収を確かめられませんでした:", error)
    })
  }
  tick()
  const timer = setInterval(tick, intervalMs)
  return () => clearInterval(timer)
}
