"use client"

import { Play } from "lucide-react"

import { Button } from "@/components/ui/button"

interface AiQuestioningSummaryProps {
  hasProposalRun: boolean
  proposalCount: number
  unansweredCount: number
  hasInstructions: boolean
  onStartNextRound: () => void
}

/**
 * 問いかける案が無いとき（まだ無い・案が出なかった・全部答えた）。全部答えて「その他」の指示が
 * あれば、次の往復（未採点の答案を項目と指示を添えて1段目から送り直す）を案内する
 * （docs/vlm-grading-design.md §3-6）
 */
export function AiQuestioningSummary({
  hasProposalRun,
  proposalCount,
  unansweredCount,
  hasInstructions,
  onStartNextRound,
}: AiQuestioningSummaryProps) {
  if (!hasProposalRun) {
    return (
      <p className="text-xs text-muted-foreground">
        AI 採点を実行すると、判定から項目の案を作り、ここで1つずつ問いかけます
      </p>
    )
  }
  if (proposalCount === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        項目の案はありませんでした
      </p>
    )
  }
  if (unansweredCount > 0) {
    return (
      <p className="text-xs text-muted-foreground">
        未回答の案が {unansweredCount}件あります。一覧から開いて答えます
      </p>
    )
  }
  return (
    <div className="space-y-1 rounded bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900">
      <p>すべての案に答えました。</p>
      {hasInstructions ? (
        <>
          <p className="text-[11px]">
            「その他」に書いた指示があります。次の往復では、未採点の答案を、今の項目と指示を添えて1段目から送り直します。
          </p>
          <Button size="sm" className="w-full" onClick={onStartNextRound}>
            <Play className="h-4 w-4" />
            次の往復を実行する
          </Button>
        </>
      ) : (
        <p className="text-[11px]">
          未採点の答案が残っていれば、採点キーで直すか、プロンプトのタブから次の往復を実行します。
        </p>
      )}
    </div>
  )
}
