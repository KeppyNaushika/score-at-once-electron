"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { AiPricingTabLink } from "@/components/common/AiPricingTabLink"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import {
  formatUsd,
  MISSING_PRICE_LABELS,
  summarizeRunCosts,
  totalTokenCount,
} from "@/lib/aiUsageCost"
import { myAiGradingRunsQuery } from "@/queries/aiGrading"
import { aiPricingQuery } from "@/queries/aiProvider"

import {
  summarizeMonthlyUsage,
  summarizeUsageByExam,
  summarizeUsageByModel,
} from "../utils/aiUsageBreakdown"
import { AiMonthlyUsageCharts } from "./AiMonthlyUsageCharts"
import {
  ExamUsageTable,
  ModelUsageTable,
  MonthlyUsageTable,
} from "./AiUsageBreakdownTables"

/**
 * 「使用トークン」タブ。すべての試験で、このアプリから自分が送った分の使用量と、
 * 入れた単価での金額の概算（事業者の残高・請求額ではない）
 */
export function AiTokenUsageTab() {
  const { data: runs } = useQuery(myAiGradingRunsQuery())
  const { data: pricing } = useQuery(aiPricingQuery())
  const breakdown = useMemo(
    () =>
      runs && pricing
        ? {
            overall: summarizeRunCosts(runs, pricing),
            monthlyUsages: summarizeMonthlyUsage(runs, pricing),
            examUsages: summarizeUsageByExam(runs, pricing),
            modelUsages: summarizeUsageByModel(runs, pricing),
          }
        : null,
    [runs, pricing]
  )

  if (!runs || !breakdown) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  const { overall, monthlyUsages, examUsages, modelUsages } = breakdown

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">使用トークン</h2>
        <p className="text-sm text-muted-foreground">
          すべての試験で、このアプリから自分が送った分です（プロンプトの改訂を含む。消した試行の分は数えられません）。
          金額は「料金」タブで入れた単価による概算で、事業者の残高・請求額ではありません。
        </p>
      </div>

      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          まだ AI に送った記録がありません。
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-xs text-muted-foreground">
                  これまでのトークン数
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums">
                {totalTokenCount(overall.usage).toLocaleString()}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-xs text-muted-foreground">
                  これまでの金額（概算）
                </CardTitle>
              </CardHeader>
              <CardContent
                className="text-2xl font-semibold tabular-nums"
                data-testid="ai-usage-total-cost"
              >
                {formatUsd(overall.pricedUsd)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-xs text-muted-foreground">
                  実行の数
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums">
                {runs.length.toLocaleString()}
              </CardContent>
            </Card>
          </div>

          {overall.unpriced.length > 0 && (
            <div
              role="status"
              className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
            >
              <p>
                次のモデルの分は単価が無いため、金額の合計に入れていません（
                <AiPricingTabLink />
                ）。
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {overall.unpriced.map((unpriced) => (
                  <li
                    key={`${unpriced.provider}/${unpriced.model}/${unpriced.mode}`}
                    className="tabular-nums"
                  >
                    <span className="font-mono">{unpriced.model}</span>
                    {unpriced.mode === "batch" && "（バッチ）"}：
                    {MISSING_PRICE_LABELS[unpriced.missing]}・
                    {totalTokenCount(unpriced.usage).toLocaleString()} トークン
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AiMonthlyUsageCharts monthlyUsages={monthlyUsages} />

          <section aria-label="月ごと" className="space-y-2">
            <h3 className="text-sm font-semibold">月ごと</h3>
            <MonthlyUsageTable monthlyUsages={monthlyUsages} />
          </section>
          <section aria-label="試験ごと" className="space-y-2">
            <h3 className="text-sm font-semibold">試験ごと</h3>
            <ExamUsageTable examUsages={examUsages} />
          </section>
          <section aria-label="モデルごと" className="space-y-2">
            <h3 className="text-sm font-semibold">モデルごと</h3>
            <ModelUsageTable modelUsages={modelUsages} />
          </section>
        </>
      )}
    </div>
  )
}
