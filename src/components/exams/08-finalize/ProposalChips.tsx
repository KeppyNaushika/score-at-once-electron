"use client"

import { MessageSquare } from "lucide-react"

import { ScaleCellMark } from "@/components/exams/07-score-at-once/ScaleLevel/ScaleCellMark"
import { getDynamicScoreStatusConfig } from "@/components/exams/07-score-at-once/ScoringGrid/constants/scoreStatusConfig"
import type { ScaleAppearanceOfVerdict } from "@/components/exams/08-finalize/types"
import {
  groupProposalsByResult,
  verdictLabelOf,
} from "@/components/exams/08-finalize/utils/proposedResults"
import { Badge } from "@/components/ui/badge"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import type { ScoreDecisionCell } from "@/types/scoreDecision.types"

interface ProposalChipsProps {
  cell: ScoreDecisionCell
  /** 類型評価の結果を類型の記号と色で出す（07 の一覧のマスと同じ見せ方） */
  scaleAppearanceOfVerdict: ScaleAppearanceOfVerdict
}

/**
 * 一覧の答案の下に出す、採点者ごとの結果。**同じ結果は1枚に束ねる**
 * （色と判定で見比べ、誰が付けたかは添えるだけ）。覚え書きがある結果には印を付け、
 * 中身は右パネルで読む（答案の下を文字で埋めない）。
 * 類型評価の結果は、判定のアイコンの代わりに類型の記号を類型の色で出す。
 */
export function ProposalChips({
  cell,
  scaleAppearanceOfVerdict,
}: ProposalChipsProps) {
  const statusConfig = getDynamicScoreStatusConfig(useScoringStatusColors())

  return (
    <div className="flex flex-wrap items-center gap-1">
      {cell.reason === "stale" && (
        <Badge className="h-4 bg-yellow-600 px-1 text-[10px]">要再確認</Badge>
      )}
      {groupProposalsByResult(cell.proposals).map((result) => {
        const config = statusConfig[result.status]
        const Icon = config.icon
        const scaleAppearance = scaleAppearanceOfVerdict(
          result.status,
          result.scaleLevelId
        )
        const graderNames = result.proposals
          .map((proposal) => proposal.userName)
          .join("・")
        const hasComment = result.proposals.some(
          (proposal) => proposal.comment !== ""
        )
        return (
          <span
            key={result.key}
            title={`${verdictLabelOf(result.status, result.scaleLevel)} ${result.scoreValue ?? "-"}点（${graderNames}）`}
            className="inline-flex max-w-full items-center gap-0.5 rounded border bg-white px-1 text-[10px] leading-4"
            style={
              scaleAppearance
                ? {
                    borderColor: scaleAppearance.colors.text,
                    backgroundColor: scaleAppearance.colors.bg,
                  }
                : { borderColor: config.iconStyle.color }
            }
          >
            {scaleAppearance ? (
              <ScaleCellMark appearance={scaleAppearance} />
            ) : (
              <Icon className="h-3 w-3 shrink-0" style={config.iconStyle} />
            )}
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
