"use client"

import { useQuery } from "@tanstack/react-query"
import { Wallet } from "lucide-react"
import { useMemo } from "react"

import { AiPricingTabLink } from "@/components/common/AiPricingTabLink"
import { SidePanelSection } from "@/components/exams/07-score-at-once/ScoringSidePanel/SidePanelSection"
import {
  formatUsd,
  MISSING_PRICE_LABELS,
  summarizeRunCosts,
  totalTokenCount,
} from "@/lib/aiUsageCost"
import { aiGradingRunsOfExamQuery } from "@/queries/aiGrading"
import { aiPricingQuery } from "@/queries/aiProvider"

interface AiExamCostSectionProps {
  examId: string
}

/**
 * この試験で自分が AI に送った分の費用の概算（すべての設問・プロンプトの改訂を含む）。
 * 金額は「AI採点」の画面の「料金」タブで入れた単価で求め、単価の無いモデルは
 * 合計に入れずに名前を挙げる
 */
export function AiExamCostSection({ examId }: AiExamCostSectionProps) {
  const { data: runs } = useQuery(aiGradingRunsOfExamQuery(examId))
  const { data: pricing } = useQuery(aiPricingQuery())
  const summary = useMemo(
    () => (runs && pricing ? summarizeRunCosts(runs, pricing) : null),
    [runs, pricing]
  )
  if (!summary) return null

  return (
    <SidePanelSection icon={Wallet} title="この試験の費用（概算）">
      <p
        className="text-right text-sm font-medium tabular-nums"
        data-testid="ai-exam-cost"
      >
        {formatUsd(summary.pricedUsd)}
      </p>
      {summary.unpriced.length > 0 && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          <p>
            単価が無いため合計に含めていません（
            <AiPricingTabLink />
            ）:
          </p>
          <ul>
            {summary.unpriced.map((unpriced) => (
              <li
                key={`${unpriced.provider}/${unpriced.model}/${unpriced.mode}`}
                className="tabular-nums"
              >
                <span className="font-mono">{unpriced.model}</span>
                {unpriced.mode === "batch" && "（バッチ）"}{" "}
                {MISSING_PRICE_LABELS[unpriced.missing]}・
                {totalTokenCount(unpriced.usage).toLocaleString()} トークン
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">
        この試験で自分が送った分の概算です。事業者の請求額ではありません
      </p>
    </SidePanelSection>
  )
}
