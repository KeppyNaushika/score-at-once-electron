"use client"

import { ChevronDown, Plus, TrendingUp, X } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
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

import type { ExamResult } from "../hooks/useStudentExamResults"

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

let nextSeriesId = 1

function createSeriesId(): string {
  return `s${nextSeriesId++}`
}

// ── コンポーネント ──

interface ScoreTrendChartProps {
  results: ExamResult[]
}

export function ScoreTrendChart({ results }: ScoreTrendChartProps) {
  const [seriesList, setSeriesList] = useState<SeriesConfig[]>(() => [
    {
      id: createSeriesId(),
      label: "合計",
      tags: new Set<string>(),
      subtotalId: "__total__",
      color: SERIES_COLORS[0],
    },
  ])

  // 全タグ一覧
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    results.forEach((r) => r.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [results])

  // 全小計一覧
  const subtotalOptions = useMemo<SubtotalOption[]>(() => {
    const map = new Map<string, SubtotalOption>()
    results.forEach((r) => {
      r.subtotalScores.forEach((s) => {
        if (!map.has(s.subtotalId)) {
          map.set(s.subtotalId, {
            id: s.subtotalId,
            label: s.subtotalName,
            groupName: s.subtotalGroupName,
          })
        }
      })
    })
    return Array.from(map.values()).sort((a, b) => {
      const g = a.groupName.localeCompare(b.groupName)
      if (g !== 0) return g
      return a.label.localeCompare(b.label)
    })
  }, [results])

  // グループ名でまとめた小計一覧
  const subtotalGroups = useMemo(() => {
    const groups = new Map<string, SubtotalOption[]>()
    for (const opt of subtotalOptions) {
      const list = groups.get(opt.groupName) || []
      list.push(opt)
      groups.set(opt.groupName, list)
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
        const opt = subtotalOptions.find((o) => o.id === subtotalId)
        if (opt) parts.push(opt.label)
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
      const colorIdx = prev.length % SERIES_COLORS.length
      const newSeries: SeriesConfig = {
        id: createSeriesId(),
        label: "合計",
        tags: new Set<string>(),
        subtotalId: "__total__",
        color: SERIES_COLORS[colorIdx],
      }
      return [...prev, newSeries]
    })
  }, [])

  // 系列の削除
  const removeSeries = useCallback((seriesId: string) => {
    setSeriesList((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((s) => s.id !== seriesId)
    })
  }, [])

  // 系列のタグ切替
  const toggleSeriesTag = useCallback(
    (seriesId: string, tag: string) => {
      setSeriesList((prev) =>
        prev.map((s) => {
          if (s.id !== seriesId) return s
          const next = new Set(s.tags)
          if (next.has(tag)) {
            next.delete(tag)
          } else {
            next.add(tag)
          }
          return { ...s, tags: next, label: buildLabel(next, s.subtotalId) }
        })
      )
    },
    [buildLabel]
  )

  const clearSeriesTags = useCallback(
    (seriesId: string) => {
      setSeriesList((prev) =>
        prev.map((s) => {
          if (s.id !== seriesId) return s
          const empty = new Set<string>()
          return { ...s, tags: empty, label: buildLabel(empty, s.subtotalId) }
        })
      )
    },
    [buildLabel]
  )

  // 系列の小計変更
  const setSeriesSubtotal = useCallback(
    (seriesId: string, subtotalId: string) => {
      setSeriesList((prev) =>
        prev.map((s) => {
          if (s.id !== seriesId) return s
          return { ...s, subtotalId, label: buildLabel(s.tags, subtotalId) }
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
        (r) =>
          r.examDate &&
          (r.status === "complete" || r.status === "partial") &&
          (series.tags.size === 0 || r.tags.some((t) => series.tags.has(t)))
      )

      for (const r of scored) {
        const key = new Date(r.examDate!).getTime()
        let score: number
        let maxScore: number

        if (series.subtotalId === "__total__") {
          score = r.totalScore
          maxScore = r.maxScore
        } else {
          const sub = r.subtotalScores.find(
            (s) => s.subtotalId === series.subtotalId
          )
          if (!sub) continue
          score = sub.score
          maxScore = sub.maxScore
        }

        const rate = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0

        if (!dateMap.has(key)) {
          dateMap.set(key, {
            date: formatShortDate(r.examDate!),
            sortKey: key,
            examName: r.examName,
          })
        }

        const entry = dateMap.get(key)!
        entry[series.id] = rate
        entry[`${series.id}_score`] = score
        entry[`${series.id}_max`] = maxScore
      }
    }

    const merged = Array.from(dateMap.values()).sort(
      (a, b) => a.sortKey - b.sortKey
    )

    const anySeriesHasData = seriesList.some((s) =>
      merged.some((d) => d[s.id] !== undefined)
    )

    return { mergedData: merged, hasData: anySeriesHasData }
  }, [results, seriesList])

  if (results.length === 0) {
    return null
  }

  return (
    <Card className="border-border/50 mb-8 shadow-sm">
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
              className="border-border/50 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
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
                          const opt = subtotalOptions.find(
                            (o) => o.id === series.subtotalId
                          )
                          return opt ? opt.label : "合計得点率"
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
                        {items.map((opt) => (
                          <DropdownMenuItem
                            key={opt.id}
                            onClick={() => setSeriesSubtotal(series.id, opt.id)}
                          >
                            {opt.label}
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
                  <span className="text-muted-foreground text-xs">タグ:</span>
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
                  className="text-muted-foreground hover:text-destructive ml-auto h-6 w-6 shrink-0"
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
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
                width={45}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const first = payload[0]?.payload
                  if (!first) return null
                  return (
                    <div className="bg-background rounded-lg border px-3 py-2 shadow-md">
                      <p className="text-sm font-medium">
                        {first.examName as string}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {first.date as string}
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {payload.map((p) => {
                          const series = seriesList.find(
                            (s) => s.id === p.dataKey
                          )
                          if (!series || p.value == null) return null
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
                              <span className="text-muted-foreground text-xs">
                                {series.label}
                              </span>
                              <span className="ml-auto font-semibold tabular-nums">
                                {score} / {max} 点（{p.value as number}
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
                  const series = seriesList.find((s) => s.id === value)
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
          <div className="text-muted-foreground py-8 text-center text-sm">
            <p>
              データが1件のみです。複数の試験結果があると推移グラフが表示されます
            </p>
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center text-sm">
            表示条件に一致する採点済みの試験がありません
          </div>
        )}
      </CardContent>
    </Card>
  )
}
