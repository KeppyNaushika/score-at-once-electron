"use client"

import type { FrequencyDistributionResult } from "@/lib/shared/spAnalysis"

interface FrequencyDistributionChartProps {
  data: FrequencyDistributionResult
}

/**
 * 得点度数分布ヒストグラム（#838）
 * 合計点を約10階級に等分した度数を横棒で表示。平均・標準偏差を併記。
 */
export function FrequencyDistributionChart({
  data,
}: FrequencyDistributionChartProps) {
  const maxCount = Math.max(...data.bins.map((bin) => bin.count), 1)

  return (
    <div className="space-y-2 p-1">
      <div className="flex gap-4 text-[11px] text-muted-foreground">
        <span>
          平均{" "}
          <span className="font-medium text-foreground">
            {data.mean.toFixed(1)}
          </span>
        </span>
        <span>
          標準偏差{" "}
          <span className="font-medium text-foreground">
            {data.stdDev.toFixed(1)}
          </span>
        </span>
        <span>
          人数 <span className="font-medium text-foreground">{data.count}</span>
        </span>
      </div>
      <div className="space-y-0.5">
        {data.bins.map((bin, i) => {
          const ratio = data.count > 0 ? (bin.count / data.count) * 100 : 0
          const widthPct = (bin.count / maxCount) * 100
          return (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <span className="w-16 text-right tabular-nums">{bin.label}</span>
              <div className="relative h-4 flex-1 rounded-sm bg-muted/40">
                <div
                  className="h-4 rounded-sm bg-primary/70"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className="w-16 text-right tabular-nums">
                {bin.count}人 ({ratio.toFixed(1)}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
