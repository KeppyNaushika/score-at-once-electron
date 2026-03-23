"use client"

import { ChevronDown, Plus, TrendingUp, X } from "lucide-react"
import { useCallback, useMemo, useRef, useState } from "react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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

import type { ClassStudentResult } from "../hooks/useClassExamResults"

// ── 型定義 ──

interface SeriesConfig {
  id: string
  label: string
  tags: Set<string>
  subtotalId: string
  color: string
  showStdDev: boolean
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
]

const formatShortDate = (date: Date) =>
  new Date(date).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  })

// ── コンポーネント ──

interface ClassScoreTrendChartProps {
  studentResults: ClassStudentResult[]
}

export function ClassScoreTrendChart({
  studentResults,
}: ClassScoreTrendChartProps) {
  const nextIdRef = useRef(1)
  const createId = useCallback(() => `cs${nextIdRef.current++}`, [])

  const [seriesList, setSeriesList] = useState<SeriesConfig[]>(() => [
    {
      id: `cs${nextIdRef.current++}`,
      label: "学級平均（合計）",
      tags: new Set<string>(),
      subtotalId: "__total__",
      color: SERIES_COLORS[0],
      showStdDev: true,
    },
  ])

  // 全タグ一覧
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    studentResults.forEach((sr) =>
      sr.examResults.forEach((r) => r.tags.forEach((t) => tagSet.add(t)))
    )
    return Array.from(tagSet).sort()
  }, [studentResults])

  // 全小計一覧
  const subtotalOptions = useMemo<SubtotalOption[]>(() => {
    const map = new Map<string, SubtotalOption>()
    studentResults.forEach((sr) =>
      sr.examResults.forEach((r) =>
        r.subtotalScores.forEach((s) => {
          if (!map.has(s.subtotalId)) {
            map.set(s.subtotalId, {
              id: s.subtotalId,
              label: s.subtotalName,
              groupName: s.subtotalGroupName,
            })
          }
        })
      )
    )
    return Array.from(map.values()).sort((a, b) => {
      const g = a.groupName.localeCompare(b.groupName)
      return g !== 0 ? g : a.label.localeCompare(b.label)
    })
  }, [studentResults])

  const subtotalGroups = useMemo(() => {
    const groups = new Map<string, SubtotalOption[]>()
    for (const opt of subtotalOptions) {
      const list = groups.get(opt.groupName) || []
      list.push(opt)
      groups.set(opt.groupName, list)
    }
    return Array.from(groups.entries())
  }, [subtotalOptions])

  const buildLabel = useCallback(
    (tags: Set<string>, subtotalId: string): string => {
      const parts: string[] = ["学級平均"]
      if (tags.size > 0) parts.push(Array.from(tags).join("・"))
      if (subtotalId !== "__total__") {
        const opt = subtotalOptions.find((o) => o.id === subtotalId)
        if (opt) parts.push(opt.label)
      } else if (tags.size === 0) {
        parts.push("合計")
      }
      return parts.join("（") + (parts.length > 1 ? "）" : "")
    },
    [subtotalOptions]
  )

  const addSeries = useCallback(() => {
    setSeriesList((prev) => [
      ...prev,
      {
        id: createId(),
        label: "学級平均（合計）",
        tags: new Set<string>(),
        subtotalId: "__total__",
        color: SERIES_COLORS[prev.length % SERIES_COLORS.length],
        showStdDev: false,
      },
    ])
  }, [createId])

  const removeSeries = useCallback((id: string) => {
    setSeriesList((prev) =>
      prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)
    )
  }, [])

  const toggleTag = useCallback(
    (seriesId: string, tag: string) => {
      setSeriesList((prev) =>
        prev.map((s) => {
          if (s.id !== seriesId) return s
          const next = new Set(s.tags)
          if (next.has(tag)) next.delete(tag)
          else next.add(tag)
          return { ...s, tags: next, label: buildLabel(next, s.subtotalId) }
        })
      )
    },
    [buildLabel]
  )

  const clearTags = useCallback(
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

  const setSubtotal = useCallback(
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

  const toggleStdDev = useCallback((seriesId: string) => {
    setSeriesList((prev) =>
      prev.map((s) =>
        s.id === seriesId ? { ...s, showStdDev: !s.showStdDev } : s
      )
    )
  }, [])

  // チャートデータ生成
  const { mergedData, hasData } = useMemo(() => {
    // 全試験を日付でグループ化
    const examDateMap = new Map<
      string,
      { examId: string; examName: string; date: Date }
    >()
    studentResults.forEach((sr) =>
      sr.examResults.forEach((r) => {
        if (r.examDate && !examDateMap.has(r.examId)) {
          examDateMap.set(r.examId, {
            examId: r.examId,
            examName: r.examName,
            date: new Date(r.examDate),
          })
        }
      })
    )

    const exams = Array.from(examDateMap.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    )

    const dataPoints: Record<string, unknown>[] = []
    let anyData = false

    for (const exam of exams) {
      const point: Record<string, unknown> = {
        date: formatShortDate(exam.date),
        sortKey: exam.date.getTime(),
        examName: exam.examName,
      }

      for (const series of seriesList) {
        const rates: number[] = []

        for (const sr of studentResults) {
          const result = sr.examResults.find(
            (r) =>
              r.examId === exam.examId &&
              (r.status === "complete" || r.status === "partial") &&
              (series.tags.size === 0 || r.tags.some((t) => series.tags.has(t)))
          )
          if (!result) continue

          let score: number
          let maxScore: number
          if (series.subtotalId === "__total__") {
            score = result.totalScore
            maxScore = result.maxScore
          } else {
            const sub = result.subtotalScores.find(
              (s) => s.subtotalId === series.subtotalId
            )
            if (!sub) continue
            score = sub.score
            maxScore = sub.maxScore
          }
          if (maxScore > 0) {
            rates.push((score / maxScore) * 100)
          }
        }

        if (rates.length > 0) {
          anyData = true
          const avg = rates.reduce((a, b) => a + b, 0) / rates.length
          const variance =
            rates.reduce((sum, r) => sum + (r - avg) ** 2, 0) / rates.length
          const stdDev = Math.sqrt(variance)

          point[series.id] = Math.round(avg * 10) / 10
          point[`${series.id}_std`] = Math.round(stdDev * 10) / 10
          point[`${series.id}_band`] = [
            Math.max(0, Math.round((avg - stdDev) * 10) / 10),
            Math.min(100, Math.round((avg + stdDev) * 10) / 10),
          ]
          point[`${series.id}_n`] = rates.length
        }
      }

      dataPoints.push(point)
    }

    return { mergedData: dataPoints, hasData: anyData }
  }, [studentResults, seriesList])

  if (studentResults.length === 0) return null

  return (
    <Card className="border-border/50 mb-8 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            学級成績の推移
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

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 rounded px-2 text-xs font-normal"
                  >
                    {series.subtotalId === "__total__"
                      ? "合計得点率"
                      : (subtotalOptions.find((o) => o.id === series.subtotalId)
                          ?.label ?? "合計得点率")}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => setSubtotal(series.id, "__total__")}
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
                            onClick={() => setSubtotal(series.id, opt.id)}
                          >
                            {opt.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {allTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground text-xs">タグ:</span>
                  <Badge
                    variant={series.tags.size === 0 ? "default" : "outline"}
                    className="h-5 cursor-pointer rounded-full px-2 text-[10px] font-normal"
                    onClick={() => clearTags(series.id)}
                  >
                    全て
                  </Badge>
                  {allTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={series.tags.has(tag) ? "default" : "outline"}
                      className="h-5 cursor-pointer rounded-full px-2 text-[10px] font-normal"
                      onClick={() => toggleTag(series.id, tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <Badge
                variant={series.showStdDev ? "default" : "outline"}
                className="h-5 cursor-pointer rounded-full px-2 text-[10px] font-normal"
                onClick={() => toggleStdDev(series.id)}
              >
                ±σ
              </Badge>

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
            <ComposedChart
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
                tickFormatter={(v) => {
                  const d = new Date(v)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
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
                        {seriesList.map((series) => {
                          const avg = first[series.id] as number | undefined
                          if (avg == null) return null
                          const std = first[`${series.id}_std`] as number
                          const n = first[`${series.id}_n`] as number
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
                                {avg}% ±{std}
                              </span>
                              <span className="text-muted-foreground text-xs tabular-nums">
                                ({n}名)
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
              {seriesList
                .filter((s) => s.showStdDev)
                .map((series) => (
                  <Area
                    key={`${series.id}_band`}
                    type="monotone"
                    dataKey={`${series.id}_band`}
                    name={`${series.id}_band`}
                    stroke="none"
                    fill={series.color}
                    fillOpacity={0.1}
                    connectNulls
                    legendType="none"
                  />
                ))}
            </ComposedChart>
          </ResponsiveContainer>
        ) : hasData && mergedData.length === 1 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            複数の試験結果があると推移グラフが表示されます
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center text-sm">
            採点済みの試験がありません
          </div>
        )}
      </CardContent>
    </Card>
  )
}
