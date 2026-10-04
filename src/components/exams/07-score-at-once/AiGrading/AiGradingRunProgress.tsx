"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { useEffect, useEffectEvent, useState } from "react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  aiGradingRunsQuery,
  cancelAiGradingRunMutation,
  subscribeAiGradingRunProgress,
} from "@/queries/aiGrading"
import type { AiGradingRunProgress as RunProgress } from "@/types/aiGrading.types"

import type { AiGradingRunRow } from "./types"

/** まだ終わっていない実行の状態 */
const ACTIVE_RUN_STATUSES = new Set(["queued", "submitting", "in_progress"])

interface AiGradingRunProgressProps {
  examId: string
  cropRegionId: string
  /** 設問の自分の実行 */
  runs: AiGradingRunRow[]
}

/**
 * 走っている採点の進み具合と中止。
 *
 * 進み具合は main から押し出される（`aiGrading:run-progress`）。届くたびに実行の一覧を
 * 取り直して試行の結果を読む。押し出しが無いあいだ（画面を開き直したとき等）は、
 * 一覧の試行の状態から数える
 */
export function AiGradingRunProgress({
  examId,
  cropRegionId,
  runs,
}: AiGradingRunProgressProps) {
  const queryClient = useQueryClient()
  const cancelRun = useMutation(
    cancelAiGradingRunMutation(examId, cropRegionId)
  )
  const [progressByRunId, setProgressByRunId] = useState<
    ReadonlyMap<string, RunProgress>
  >(new Map())

  const handleProgress = useEffectEvent((progress: RunProgress) => {
    if (progress.cropRegionId !== cropRegionId) return
    setProgressByRunId((prev) => new Map(prev).set(progress.runId, progress))
    // 走っている取り直しは使い回す（届くたびに打ち切って始め直さない）
    void queryClient.invalidateQueries(
      { queryKey: aiGradingRunsQuery(examId, cropRegionId, false).queryKey },
      { cancelRefetch: false }
    )
  })
  useEffect(
    () => subscribeAiGradingRunProgress((progress) => handleProgress(progress)),
    []
  )

  const activeRuns = runs.filter((run) => ACTIVE_RUN_STATUSES.has(run.status))
  if (activeRuns.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      {activeRuns.map((run) => {
        const progress = progressByRunId.get(run.id)
        const total = progress?.total ?? run.attempts.length
        const completed =
          progress?.completed ??
          run.attempts.filter((attempt) => attempt.state !== "pending").length
        return (
          <div
            key={run.id}
            className="flex items-center gap-2 text-xs"
            aria-label="AI 採点の進み具合"
          >
            <span className="shrink-0">
              {run.mode === "batch" ? "バッチ" : "採点中"} {completed}/{total}
            </span>
            <Progress
              value={total > 0 ? (completed / total) * 100 : 0}
              className="w-32"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1"
              onClick={() => cancelRun.mutate(run.id)}
              disabled={cancelRun.isPending}
            >
              <X className="h-3 w-3" />
              中止
            </Button>
          </div>
        )
      })}
    </div>
  )
}
