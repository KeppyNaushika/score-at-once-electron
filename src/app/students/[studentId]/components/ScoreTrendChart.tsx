"use client"

import { ChevronDown, Plus, TrendingUp, X } from "lucide-react"
import { useCallback, useMemo, useRef, useState } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { StudentExamResult } from "@/electron-src/lib/prisma/student"

// ── 型定義 ──

interface SeriesConfig {
  id: string
  label: string
  tags: Set<string>
  subtotalId: string // "__total__" or subtotalId
  color: string
}

interface SubtotalOption {
  id: string
  label: string
  groupName: string
}

// ── 定数 ──

const SERIES_COLORS = [
  "hsl(210, 70%, 50%)",
  "hsl(150, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 65%, 55%)",
  "hsl(180, 55%, 45%)",
  "hsl(60, 65%, 45%)",
  "hsl(330, 60%, 55%)",
]

const formatShortDate = (date: Date) =>
  new Date(date).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  })

// ── コンポーネント ──

interface ScoreTrendChartProps {
  results: StudentExamResult[]
}

export function ScoreTrendChart({ results }: ScoreTrendChartProps) {
  const nextIdRef = useRef(1)
  const createId = useCallback(() => `s${nextIdRef.current++}`, [])

  const [seriesList, setSeriesList] = useState<SeriesConfig[]>(() => [
    {
      id: `s${nextIdRef.current++}`,
      label: "合計",
      tags: new Set<string>(),
      subtotalId: "__total__",
      color: SERIES_COLORS[0],
    },
  ])

  // 全タグ一覧
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    results.forEach((examResult) =>
      examResult.tags.forEach((tag) => tagSet.add(tag))
    )
    return Array.from(tagSet).sort()
  }, [results])

  // 全小計一覧
  const subtotalOptions = useMemo<SubtotalOption[]>(() => {
    const map = new Map<string, SubtotalOption>()
    results.forEach((examResult) => {
      examResult.subtotalScores.forEach((subtotalScore) => {
        if (!map.has(subtotalScore.subtotalId)) {
          map.set(subtotalScore.subtotalId, {
            id: subtotalScore.subtotalId,
            label: subtotalScore.subtotalName,
            groupName: subtotalScore.subtotalGroupName,
          })
        }
      })
    })
    return Array.from(map.values()).sort((optionA, optionB) => {
      const groupComparison = optionA.groupName.localeCompare(optionB.groupName)
      if (groupComparison !== 0) return groupComparison
      return optionA.label.localeCompare(optionB.label)
    })
  }, [results])

  // グループ名でまとめた小計一覧
  const subtotalGroups = useMemo(() => {
    const groups = new Map<string, SubtotalOption[]>()
    for (const option of subtotalOptions) {
      const list = groups.get(option.groupName) || []
      list.push(option)
      groups.set(option.groupName, list)
    }
    return Array.from(groups.entries())
  }, [subtotalOptions])

  // 系列のラベルを生成
  const buildLabel = useCallback(
    (tags: Set<string>, subtotalId: string): string => {
      const parts: string[] = []
      if (tags.size > 0) {
        parts.push(Array.from(tags).join("・"))
      }
      if (subtotalId !== "__total__") {
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

  // 系列の追加
  const addSeries = useCallback(() => {
    setSeriesList((prev) => {
      const colorIndex = prev.length % SERIES_COLORS.length
      const newSeries: SeriesConfig = {
        id: createId(),
        label: "合計",
        tags: new Set<string>(),
        subtotalId: "__total__",
        color: SERIES_COLORS[colorIndex],
      }
      return [...prev, newSeries]
    })
  }, [createId])

  // 系列の削除
  const removeSeries = useCallback((seriesId: string) => {
    setSeriesList((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((series) => series.id !== seriesId)
    })
  }, [])

  // 系列のタグ切替
  const toggleSeriesTag = useCallback(
    (seriesId: string, tag: string) => {
      setSeriesList((prev) =>
        prev.map((series) => {
          if (series.id !== seriesId) return series
          const next = new Set(series.tags)
          if (next.has(tag)) {
            next.delete(tag)
          } else {
            next.add(tag)
          }
          return {
            ...series,
            tags: next,
            label: buildLabel(next, series.subtotalId),
          }
        })
      )
    },
    [buildLabel]
  )

  const clearSeriesTags = useCallback(
    (seriesId: string) => {
      setSeriesList((prev) =>
        prev.map((series) => {
          if (series.id !== seriesId) return series
          const empty = new Set<string>()
          return {
            ...series,
            tags: empty,
            label: buildLabel(empty, series.subtotalId),
          }
        })
      )
    },
    [buildLabel]
  )

  // 系列の小計変更
  const setSeriesSubtotal = useCallback(
    (seriesId: string, subtotalId: string) => {
      setSeriesList((prev) =>
        prev.map((series) => {
          if (series.id !== seriesId) return series
          return {
            ...series,
            subtotalId,
            label: buildLabel(series.tags, subtotalId),
          }
        })
      )
    },
    [buildLabel]
  )

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
          examResult.examDate &&
          (examResult.status === "complete" ||
            examResult.status === "partial") &&
          (series.tags.size === 0 ||
            examResult.tags.some((tag) => series.tags.has(tag)))
      )

      for (const examResult of scored) {
        const key = new Date(examResult.examDate!).getTime()
        let score: number
        let maxScore: number

        if (series.subtotalId === "__total__") {
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
            date: formatShortDate(examResult.examDate!),
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
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            成績の推移
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={addSeries}
          >
            <Plus className="mr-1 h-4 w-4" />
            系列を追加
          </Button>
        </div>

        {/* 系列設定 */}
        <div className="space-y-2">
          {seriesList.map((series) => (
            <div
              key={series.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 px-3 py-2"
            >
              <div
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: series.color }}
              />

              {/* 小計選択 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 rounded px-2 text-xs font-normal"
                  >
                    {series.subtotalId === "__total__"
                      ? "合計得点率"
                      : (() => {
                          const matchedOption = subtotalOptions.find(
                            (option) => option.id === series.subtotalId
                          )
                          return matchedOption
                            ? matchedOption.label
                            : "合計得点率"
                        })()}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => setSeriesSubtotal(series.id, "__total__")}
                  >
                    合計得点率
                  </DropdownMenuItem>
                  {subtotalGroups.map(([groupName, items]) => (
                    <DropdownMenuSub key={groupName}>
                      <DropdownMenuSubTrigger>
                        {groupName}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {items.map((option) => (
                          <DropdownMenuItem
                            key={option.id}
                            onClick={() =>
                              setSeriesSubtotal(series.id, option.id)
                            }
                          >
                            {option.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* タグフィルタ */}
              {allTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-xs text-muted-foreground">タグ:</span>
                  <Badge
                    variant={series.tags.size === 0 ? "default" : "outline"}
                    className="h-5 cursor-pointer rounded-full px-2 text-[10px] font-normal"
                    onClick={() => clearSeriesTags(series.id)}
                  >
                    全て
                  </Badge>
                  {allTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={series.tags.has(tag) ? "default" : "outline"}
                      className="h-5 cursor-pointer rounded-full px-2 text-[10px] font-normal"
                      onClick={() => toggleSeriesTag(series.id, tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* 削除ボタン */}
              {seriesList.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeSeries(series.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardHeader>

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
                tickFormatter={(tickValue) => {
                  const date = new Date(tickValue)
                  return `${date.getMonth() + 1}/${date.getDate()}`
                }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(tickValue) => `${tickValue}%`}
                width={45}
              />
              <Tooltip
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
