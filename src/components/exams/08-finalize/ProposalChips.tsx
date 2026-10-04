"use client"

import { MessageSquare } from "lucide-react"

import { getDynamicScoreStatusConfig } from "@/components/exams/07-score-at-once/ScoringGrid/constants/scoreStatusConfig"
import { groupProposalsByResult } from "@/components/exams/08-finalize/utils/proposedResults"
import { Badge } from "@/components/ui/badge"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { SCORING_STATUS_LABELS } from "@/lib/scoringStatusColors"
import type { ScoreDecisionCell } from "@/types/scoreDecision.types"

interface ProposalChipsProps {
  cell: ScoreDecisionCell
}

/**
 * 一覧の答案の下に出す、採点者ごとの結果。**同じ結果は1枚に束ねる**
 * （色と判定で見比べ、誰が付けたかは添えるだけ）。覚え書きがある結果には印を付け、
 * 中身は右パネルで読む（答案の下を文字で埋めない）。
 */
export function ProposalChips({ cell }: ProposalChipsProps) {
  const statusConfig = getDynamicScoreStatusConfig(useScoringStatusColors())

  return (
    <div className="flex flex-wrap items-center gap-1">
      {cell.reason === "stale" && (
        <Badge className="h-4 bg-yellow-600 px-1 text-[10px]">要再確認</Badge>
      )}
      {groupProposalsByResult(cell.proposals).map((result) => {
        const config = statusConfig[result.status]
        const Icon = config.icon
        const graderNames = result.proposals
          .map((proposal) => proposal.userName)
          .join("・")
        const hasComment = result.proposals.some(
          (proposal) => proposal.comment !== ""
        )
        return (
          <span
            key={result.key}
            title={`${SCORING_STATUS_LABELS[result.status]} ${result.scoreValue ?? "-"}点（${graderNames}）`}
            className="inline-flex max-w-full items-center gap-0.5 rounded border bg-white px-1 text-[10px] leading-4"
            style={{ borderColor: config.iconStyle.color }}
          >
            <Icon className="h-3 w-3 shrink-0" style={config.iconStyle} />
            <span className="shrink-0 font-medium">
              {result.scoreValue ?? "-"}
            </span>
            <span className="truncate text-gray-600">{graderNames}</span>
            {hasComment && (
              <MessageSquare className="h-2.5 w-2.5 shrink-0 text-gray-500" />
            )}
          </span>
        )
      })}
    </div>
  )
}
