"use client"

import { useCallback, useMemo } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

import {
  collectSubtotalOptions,
  collectTrendTags,
  formatDateTick,
  formatPercentTick,
  formatShortDate,
  groupSubtotalOptions,
  SERIES_COLORS,
} from "@/components/score-trend/scoreTrendOptions"
import { TrendSeriesEditor } from "@/components/score-trend/TrendSeriesEditor"
import {
  TOTAL_SUBTOTAL_ID,
  type TrendSeries,
} from "@/components/score-trend/types"
import { useTrendSeriesList } from "@/components/score-trend/useTrendSeriesList"
import { Card, CardContent } from "@/components/ui/card"
import type { StudentExamResult } from "@/electron-src/lib/prisma/student"

/** 系列を足したときの姿（合計得点率・タグ無し） */
function createSeries(id: string, color: string): TrendSeries {
  return {
    id,
    label: "合計",
    tags: new Set<string>(),
    subtotalId: TOTAL_SUBTOTAL_ID,
    color,
  }
}

function createInitialSeries(): TrendSeries {
  return createSeries("s0", SERIES_COLORS[0])
}

interface ScoreTrendChartProps {
  results: StudentExamResult[]
}

export function ScoreTrendChart({ results }: ScoreTrendChartProps) {
  // 全タグ一覧
  const allTags = useMemo(() => collectTrendTags(results), [results])

  // 全小計一覧
  const subtotalOptions = useMemo(
    () => collectSubtotalOptions(results),
    [results]
  )

  // グループ名でまとめた小計一覧
  const subtotalGroups = useMemo(
    () => groupSubtotalOptions(subtotalOptions),
    [subtotalOptions]
  )

  // 系列のラベルを生成
  const buildLabel = useCallback(
    (tags: Set<string>, subtotalId: string): string => {
      const parts: string[] = []
      if (tags.size > 0) {
        parts.push(Array.from(tags).join("・"))
      }
      if (subtotalId !== TOTAL_SUBTOTAL_ID) {
        const matchedOption = subtotalOptions.find(
          (option) => option.id === subtotalId
        )
        if (matchedOption) parts.push(matchedOption.label)
      } else {
        parts.push("合計")
      }
      return parts.join(" / ")
    },
    [subtotalOptions]
  )

  const {
    seriesList,
    addSeries,
    removeSeries,
    toggleTag,
    clearTags,
    setSubtotal,
  } = useTrendSeriesList({
    idPrefix: "s",
    createInitialSeries,
    createSeries,
    colors: SERIES_COLORS,
    buildLabel,
  })

  // チャートデータ生成 — 全系列を統合した横持ちデータ
  const { mergedData, hasData } = useMemo(() => {
    // 各試験日のデータを統合
    const dateMap = new Map<
      number,
      { date: string; sortKey: number; examName: string } & Record<
        string,
        number | string
      >
    >()

    for (const series of seriesList) {
      const scored = results.filter(
        (examResult) =>
          examResult.referenceDate &&
          (examResult.status === "complete" ||
            examResult.status === "partial") &&
          (series.tags.size === 0 ||
            examResult.tags.some((tag) => series.tags.has(tag)))
      )

      for (const examResult of scored) {
        const key = new Date(examResult.referenceDate!).getTime()
        let score: number
        let maxScore: number

        if (series.subtotalId === TOTAL_SUBTOTAL_ID) {
          score = examResult.totalScore
          maxScore = examResult.maxScore
        } else {
          const matchedSubtotal = examResult.subtotalScores.find(
            (subtotalScore) => subtotalScore.subtotalId === series.subtotalId
          )
          if (!matchedSubtotal) continue
          score = matchedSubtotal.score
          maxScore = matchedSubtotal.maxScore
        }

        const rate = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0

        if (!dateMap.has(key)) {
          dateMap.set(key, {
            date: formatShortDate(examResult.referenceDate!),
            sortKey: key,
            examName: examResult.examName,
          })
        }

        const entry = dateMap.get(key)!
        entry[series.id] = rate
        entry[`${series.id}_score`] = score
        entry[`${series.id}_max`] = maxScore
      }
    }

    const merged = Array.from(dateMap.values()).sort(
      (entryA, entryB) => entryA.sortKey - entryB.sortKey
    )

    const anySeriesHasData = seriesList.some((series) =>
      merged.some((entry) => entry[series.id] !== undefined)
    )

    return { mergedData: merged, hasData: anySeriesHasData }
  }, [results, seriesList])

  if (results.length === 0) {
    return null
  }

  return (
    <Card className="mb-8 border-border/50 shadow-sm">
      <TrendSeriesEditor
        title="成績の推移"
        seriesList={seriesList}
        subtotalOptions={subtotalOptions}
        subtotalGroups={subtotalGroups}
        allTags={allTags}
        onAddSeries={addSeries}
        onRemoveSeries={removeSeries}
        onToggleTag={toggleTag}
        onClearTags={clearTags}
        onSetSubtotal={setSubtotal}
      />

      <CardContent>
        {hasData && mergedData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={mergedData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="sortKey"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
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
                  const first = payload[0]?.payload
                  if (!first) return null
                  return (
                    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                      <p className="text-sm font-medium">
                        {first.examName as string}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {first.date as string}
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {payload.map((payloadEntry) => {
                          const series = seriesList.find(
                            (candidate) => candidate.id === payloadEntry.dataKey
                          )
                          if (!series || payloadEntry.value == null) return null
                          const score = first[`${series.id}_score`] as number
                          const max = first[`${series.id}_max`] as number
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
                              <span className="ml-auto font-semibold tabular-nums">
                                {score} / {max} 点（
                                {payloadEntry.value as number}
                                %）
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }}
              />
              <Legend
                formatter={(value) => {
                  const series = seriesList.find(
                    (candidate) => candidate.id === value
                  )
                  return (
                    <span className="text-xs">{series?.label ?? value}</span>
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
            </LineChart>
          </ResponsiveContainer>
        ) : hasData && mergedData.length === 1 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <p>
              データが1件のみです。複数の試験結果があると推移グラフが表示されます
            </p>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            表示条件に一致する採点済みの試験がありません
          </div>
        )}
      </CardContent>
    </Card>
  )
}
