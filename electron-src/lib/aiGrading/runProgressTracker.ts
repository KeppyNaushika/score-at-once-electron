/**
 * 実行1回ぶんの進み具合を数え、書くたびに画面へ押し出す。
 *
 * 数は表示のためだけのもの（結果そのものは試行の行を取り直して読む）。
 */

import type {
  AiGradingAttemptState,
  AiGradingRunProgress,
  AiGradingRunStatus,
} from "@/types/aiGrading.types"

export function createRunProgressTracker(input: {
  runId: string
  cropRegionId: string
  total: number
  notifyProgress: (progress: AiGradingRunProgress) => void
}) {
  const progress: AiGradingRunProgress = {
    runId: input.runId,
    cropRegionId: input.cropRegionId,
    status: "in_progress",
    total: input.total,
    completed: 0,
    succeeded: 0,
    failed: 0,
  }
  const push = () => input.notifyProgress({ ...progress })

  return {
    /** 試行を1件書いた */
    record(state: Exclude<AiGradingAttemptState, "pending">) {
      progress.completed += 1
      if (state === "succeeded") progress.succeeded += 1
      else progress.failed += 1
      push()
    },
    /** 状態だけが変わった（バッチを預け終えた等） */
    update(status: AiGradingRunStatus) {
      progress.status = status
      push()
    },
    /** 終わった。結果待ちのまま閉じた試行も失敗として数える */
    finish(status: AiGradingRunStatus) {
      progress.status = status
      progress.failed = progress.total - progress.succeeded
      progress.completed = progress.total
      push()
    },
  }
}
