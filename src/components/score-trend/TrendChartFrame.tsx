"use client"

import { type ReactNode, useMemo } from "react"
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent } from "@/components/ui/card"

import { formatDateTick, formatPercentTick } from "./scoreTrendOptions"
import { trendPlotDomain } from "./trendPoints"
import type { TrendChartPointBase, TrendSeries } from "./types"

interface TrendChartFrameProps<
  TSeries extends TrendSeries,
  TPoint extends TrendChartPointBase,
> {
  /** カードの頭（系列の編集） */
  header: ReactNode
  /** 値のある試験だけの点（試験日順）。点の数で案内とグラフを切り替える */
  data: TPoint[]
  seriesList: TSeries[]
  /**
   * ツールチップの系列1行のうち、系列名より後ろ（数値）。その点に値が無い系列は
   * null を返し、行ごと出さない
   */
  renderTooltipValue: (series: TSeries, point: TPoint) => ReactNode | null
  /** 値のある点が1つだけのときの案内 */
  singlePointMessage: ReactNode
  /** 値のある点が無いときの案内 */
  emptyMessage: ReactNode
  /** 折れ線の後ろに重ねるもの（学級の ±σ の帯など）。recharts の要素を渡す */
  children?: ReactNode
}

/**
 * 得点率の推移グラフの枠（カード・軸・凡例・折れ線・ツールチップの外枠・空のときの案内）。
 * 生徒の詳細と学級の詳細が同じ姿を書き並べていたのを1つにした。点の作り方と
 * ツールチップの数値は画面ごとに違うので呼び手が渡す。
 *
 * X 軸は時刻の軸で、試験日の間隔が横の距離に出る。近すぎる点（同じ日・日が近い）は
 * 点の作り手が描く位置（`plotTime`）を譲り合わせてあるので、点は重ならず、
 * ツールチップもそれぞれの試験を指す。目盛りは実際の試験日の位置（その日の 0 時）に置く。
 */
export function TrendChartFrame<
  TSeries extends TrendSeries,
  TPoint extends TrendChartPointBase,
>({
  header,
  data,
  seriesList,
  renderTooltipValue,
  singlePointMessage,
  emptyMessage,
  children,
}: TrendChartFrameProps<TSeries, TPoint>) {
  const plotDomain = useMemo(() => trendPlotDomain(data), [data])
  const dayTicks = useMemo(
    () => Array.from(new Set(data.map((point) => point.dayTime))),
    [data]
  )

  return (
    <Card className="mb-8 border-border/50 shadow-sm">
      {header}

      <CardContent>
        {data.length >= 2 ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart
              data={data}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="plotTime"
                type="number"
                scale="time"
                domain={plotDomain}
                ticks={dayTicks}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatDateTick}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatPercentTick}
                width={45}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const point: TPoint | undefined = payload[0]?.payload
                  if (!point) return null
                  return (
                    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                      <p className="text-sm font-medium">{point.examName}</p>
                      <p className="text-xs text-muted-foreground">
                        {point.date}
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {seriesList.map((series) => {
                          const tooltipValue = renderTooltipValue(series, point)
                          if (tooltipValue == null) return null
                          return (
                            <div
                              key={series.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <div
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: series.color }}
                              />
                              <span className="text-xs text-muted-foreground">
                                {series.label}
                              </span>
                              {tooltipValue}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }}
              />
              <Legend
                formatter={(legendValue) => {
                  const series = seriesList.find(
                    (candidate) => candidate.id === legendValue
                  )
                  return (
                    <span className="text-xs">
                      {series?.label ?? legendValue}
                    </span>
                  )
                }}
              />
              {seriesList.map((series) => (
                <Line
                  key={series.id}
                  type="monotone"
                  dataKey={series.id}
                  name={series.id}
                  stroke={series.color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: series.color }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
              {children}
            </ComposedChart>
          </ResponsiveContainer>
        ) : data.length === 1 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {singlePointMessage}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
