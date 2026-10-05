"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RecordedTokenUsage } from "@/lib/aiUsageCost"

import type { MonthlyUsage } from "../utils/aiUsageBreakdown"

/** トークンの種類ごとの系列（積み上げの順・色は固定。色覚の差でも隣どうしが分かれる並び） */
const TOKEN_SERIES: {
  key: keyof RecordedTokenUsage
  label: string
  color: string
}[] = [
  { key: "inputTokens", label: "入力", color: "#2a78d6" },
  { key: "outputTokens", label: "出力", color: "#eb6834" },
  { key: "cacheReadTokens", label: "キャッシュ読み", color: "#1baf7a" },
  { key: "cacheWriteTokens", label: "キャッシュ書き", color: "#eda100" },
]

const COST_COLOR = "#2a78d6"

/** 軸の目盛り（トークン数を短く） */
const compactNumberFormat = new Intl.NumberFormat("ja-JP", {
  notation: "compact",
  maximumFractionDigits: 1,
})

/** "2026-10" を "2026/10" にする */
function formatMonthLabel(monthKey: string): string {
  return monthKey.replace("-", "/")
}

interface AiMonthlyUsageChartsProps {
  monthlyUsages: readonly MonthlyUsage[]
}

/** 月ごとのトークン数（種類で積み上げ）と、月ごとの金額（単価の分かる分だけ） */
export function AiMonthlyUsageCharts({
  monthlyUsages,
}: AiMonthlyUsageChartsProps) {
  const chartRows = monthlyUsages.map((monthlyUsage) => ({
    month: formatMonthLabel(monthlyUsage.monthKey),
    ...monthlyUsage.usage,
    pricedUsd: monthlyUsage.pricedUsd,
  }))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">月ごとのトークン数</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(tick: number) =>
                  compactNumberFormat.format(tick)
                }
                width={48}
              />
              <RechartsTooltip
                formatter={(amount) =>
                  typeof amount === "number"
                    ? `${amount.toLocaleString()} トークン`
                    : String(amount)
                }
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {TOKEN_SERIES.map((series, seriesIndex) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.label}
                  stackId="tokens"
                  fill={series.color}
                  stroke="var(--background)"
                  strokeWidth={1}
                  radius={
                    seriesIndex === TOKEN_SERIES.length - 1
                      ? [4, 4, 0, 0]
                      : undefined
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            月ごとの金額（概算・単価の分かる分）
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(tick: number) => `$${tick}`}
                width={48}
              />
              <RechartsTooltip
                formatter={(amount) =>
                  typeof amount === "number"
                    ? `$${amount.toFixed(2)}`
                    : String(amount)
                }
              />
              <Bar
                dataKey="pricedUsd"
                name="金額（米ドル）"
                fill={COST_COLOR}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
