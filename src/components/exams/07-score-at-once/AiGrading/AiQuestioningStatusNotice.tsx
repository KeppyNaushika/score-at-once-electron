"use client"

import { useMutation } from "@tanstack/react-query"
import { Loader2, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { startAiGroupingRunMutation } from "@/queries/aiGrading"

import type { QuestioningStatus } from "./utils/questioningFlow"

interface AiQuestioningStatusNoticeProps {
  examId: string
  cropRegionId: string
  status: QuestioningStatus
}

/**
 * 問いかけの前提の状態（docs/vlm-grading-design.md §3-4）。1段目・2段目が走っている間、
 * 2段目が失敗したとき（送り直し）、2段目が自動で始まらなかったとき（作る）を示す。
 * 送り直しは1段目の判定を文字だけで送る（画像は送らない）
 */
export function AiQuestioningStatusNotice({
  examId,
  cropRegionId,
  status,
}: AiQuestioningStatusNoticeProps) {
  const grouping = useMutation(startAiGroupingRunMutation(examId, cropRegionId))

  switch (status.kind) {
    case "grading":
      return (
        <p className="flex items-center gap-1 rounded bg-sky-50 px-2 py-1.5 text-[11px] text-sky-800">
          <Loader2 className="h-3 w-3 animate-spin" />
          答案ごとの判定を実行しています。終わると、続けて項目の案を作ります
        </p>
      )
    case "grouping":
      return (
        <p className="flex items-center gap-1 rounded bg-sky-50 px-2 py-1.5 text-[11px] text-sky-800">
          <Loader2 className="h-3 w-3 animate-spin" />
          判定から項目の案を作っています
        </p>
      )
    case "failed":
    case "notGrouped":
      return (
        <div className="space-y-1 rounded bg-orange-50 px-2 py-1.5 text-[11px] text-orange-900">
          <p>
            {status.kind === "failed"
              ? "項目の案を作れませんでした。"
              : "最後の判定から、項目の案がまだ作られていません。"}
            判定の文字だけを送って作り直せます（答案の画像は送りません）。
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-xs"
            disabled={grouping.isPending}
            onClick={() => grouping.mutate(status.gradeRunId)}
          >
            {grouping.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            {status.kind === "failed" ? "送り直す" : "項目の案を作る"}
          </Button>
        </div>
      )
    case "idle":
    case "ready":
      return null
  }
}
