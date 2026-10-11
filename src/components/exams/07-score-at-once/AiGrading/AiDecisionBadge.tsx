"use client"

import { getDynamicScoreStatusConfig } from "@/components/exams/07-score-at-once/ScoringGrid/constants/scoreStatusConfig"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"

import type { QuestioningDecisionBadge } from "./utils/questioningSteps"

interface AiDecisionBadgeProps {
  /** 決めたことの札。未回答なら null */
  badge: QuestioningDecisionBadge | null
}

/**
 * 問いの一覧の行の右に出す、決めたことの札。答案に点を付ける選択肢は採点の状態の色
 * （［正答］［部分点 4点］）、それ以外は色の無い札、未回答は破線の薄い札
 */
export function AiDecisionBadge({ badge }: AiDecisionBadgeProps) {
  const statusConfig = getDynamicScoreStatusConfig(useScoringStatusColors())
  const frameClass =
    "inline-block max-w-28 truncate rounded border px-1.5 text-[10px] leading-4"
  if (!badge) {
    return (
      <span
        className={`${frameClass} border-dashed border-gray-300 text-muted-foreground`}
      >
        未回答
      </span>
    )
  }
  if (!badge.status) {
    return (
      <span
        className={`${frameClass} border-gray-300 bg-gray-50 text-gray-700`}
      >
        {badge.label}
      </span>
    )
  }
  const config = statusConfig[badge.status]
  return (
    <span
      className={`${frameClass} font-medium`}
      style={{
        borderColor: config.iconStyle.color,
        backgroundColor: config.bgStyle.backgroundColor,
        color: config.textStyle.color,
      }}
    >
      {badge.label}
    </span>
  )
}
