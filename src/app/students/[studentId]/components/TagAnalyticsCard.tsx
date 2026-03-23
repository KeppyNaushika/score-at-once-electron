"use client"

import { BarChart3, ChevronDown, Plus, X } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

interface BarSeriesConfig {
  id: string
  label: string
  tags: Set<string>
  subtotalId: string
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

let nextBarSeriesId = 1

function createBarSeriesId(): string {
  return `b${nextBarSeriesId++}`
}

// ── コンポーネント ──

interface TagAnalyticsCardProps {
  results: ExamResult[]
}

export function TagAnalyticsCard({ results }: TagAnalyticsCardProps) {
  // 初期状態：タグが1つ以上あれば各タグを系列に、なければ合計1つ
  const [seriesList, setSeriesList] = useState<BarSeriesConfig[]>(() => {
    const tagSet = new Set<string>()
    results.forEach((r) => r.tags.forEach((t) => tagSet.add(t)))
    const tags = Array.from(tagSet).sort()

    if (tags.length > 0) {
      return tags.map((tag, i) => ({
        id: createBarSeriesId(),
        label: tag,
        tags: new Set([tag]),
        subtotalId: "__total__",
        color: SERIES_COLORS[i % SERIES_COLORS.length],
      }))
    }
    return [
      {
        id: createBarSeriesId(),
        label: "合計",
        tags: new Set<string>(),
        subtotalId: "__total__",
        color: SERIES_COLORS[0],
      },
    ]
  })

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

  // グループ化した小計一覧
  const subtotalGroups = useMemo(() => {
    const groups = new Map<string, SubtotalOption[]>()
    for (const opt of subtotalOptions) {
      const list = groups.get(opt.groupName) || []
      list.push(opt)
      groups.set(opt.groupName, list)
    }
    return Array.from(groups.entries())
  }, [subtotalOptions])

  // ラベル生成
  const buildLabel = useCallback(
    (tags: Set<string>, subtotalId: string): string => {
      const parts: string[] = []
      if (tags.size > 0) {
        parts.push(Array.from(tags).join("・"))
      }
      if (subtotalId !== "__total__") {
        const opt = subtotalOptions.find((o) => o.id === subtotalId)
        if (opt) parts.push(opt.label)
      } else if (tags.size === 0) {
        parts.push("合計")
      }
      return parts.join(" / ")
    },
    [subtotalOptions]
  )

  const addSeries = useCallback(() => {
    setSeriesList((prev) => {
      const colorIdx = prev.length % SERIES_COLORS.length
      return [
        ...prev,
        {
          id: createBarSeriesId(),
          label: "合計",
          tags: new Set<string>(),
          subtotalId: "__total__",
          color: SERIES_COLORS[colorIdx],
        },
      ]
    })
  }, [])

  const removeSeries = useCallback((seriesId: string) => {
    setSeriesList((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((s) => s.id !== seriesId)
    })
  }, [])

  const toggleSeriesTag = useCallback(
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

  // 棒グラフデータ生成
  const chartData = useMemo(() => {
    return seriesList.map((series) => {
      const scored = results.filter(
        (r) =>
          (r.status === "complete" || r.status === "partial") &&
          (series.tags.size === 0 || r.tags.some((t) => series.tags.has(t)))
      )

      let totalRate = 0
      let count = 0

      for (const r of scored) {
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

        if (maxScore > 0) {
          totalRate += (score / maxScore) * 100
          count++
        }
      }

      return {
        id: series.id,
        label: series.label,
        avgRate: count > 0 ? Math.round(totalRate / count) : 0,
        examCount: count,
        color: series.color,
      }
    })
  }, [results, seriesList])

  if (results.filter((r) => r.status !== "unscored").length === 0) {
    return null
  }

  return (
    <Card className="border-border/50 mb-8 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            平均得点率の比較
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
        <ResponsiveContainer
          width="100%"
          height={Math.max(160, chartData.length * 44 + 40)}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              opacity={0.3}
              horizontal={false}
            />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={100}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload as {
                  label: string
                  avgRate: number
                  examCount: number
                }
                return (
                  <div className="bg-background rounded-lg border px-3 py-2 shadow-md">
                    <p className="text-sm font-medium">{d.label}</p>
                    <p className="mt-1 text-sm tabular-nums">
                      平均得点率：
                      <span className="font-semibold">{d.avgRate}%</span>
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {d.examCount}回の試験
                    </p>
                  </div>
                )
              }}
            />
            <Bar dataKey="avgRate" radius={[0, 4, 4, 0]} barSize={28}>
              {chartData.map((d) => (
                <Cell key={d.id} fill={d.color} opacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
