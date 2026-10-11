"use client"

import { useQuery } from "@tanstack/react-query"
import { Wallet } from "lucide-react"
import { useMemo } from "react"

import { WithTooltip } from "@/components/common/WithTooltip"
import { useAiGradingAvailability } from "@/hooks/useAiGradingAvailability"
import { formatUsd, summarizeRunCosts } from "@/lib/aiUsageCost"
import { aiGradingRunsOfExamQuery } from "@/queries/aiGrading"
import { aiPricingQuery } from "@/queries/aiProvider"

interface AiExamCostBadgeProps {
  examId: string
}

/**
 * 採点モードの行の左端に出す、この試験の AI の費用の概算。
 * AI 採点を使える事業者が無いとき・この試験でまだ AI に送っていないときは出さない
 */
export function AiExamCostBadge({ examId }: AiExamCostBadgeProps) {
  const { unlockedProviders } = useAiGradingAvailability()
  const isAvailable = unlockedProviders.length > 0
  const { data: runs } = useQuery({
    ...aiGradingRunsOfExamQuery(examId),
    enabled: isAvailable,
  })
  const { data: pricing } = useQuery({
    ...aiPricingQuery(),
    enabled: isAvailable,
  })
  const summary = useMemo(
    () => (runs && pricing ? summarizeRunCosts(runs, pricing) : null),
    [runs, pricing]
  )
  if (!isAvailable || !runs || runs.length === 0 || !summary) return null

  const unpricedNote =
    summary.unpriced.length > 0 ? "単価の無いモデルの分は含みません。" : ""
  return (
    <WithTooltip
      content={`この試験で自分が AI に送った分の費用の概算です。${unpricedNote}`}
    >
      <span
        className="flex items-center gap-1.5 text-sm font-medium text-foreground tabular-nums"
        data-testid="ai-exam-cost-badge"
      >
        <Wallet className="h-4 w-4" aria-hidden />
        AI {formatUsd(summary.pricedUsd)}
        {summary.unpriced.length > 0 && "+"}
      </span>
    </WithTooltip>
  )
}
