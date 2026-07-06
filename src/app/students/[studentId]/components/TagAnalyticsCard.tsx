"use client"

import { BarChart3, ChevronDown, Plus, X } from "lucide-react"
import { useCallback, useMemo, useRef, useState } from "react"
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
import type { StudentExamResult } from "@/electron-src/lib/prisma/student"

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

// ── コンポーネント ──

interface TagAnalyticsCardProps {
  results: StudentExamResult[]
}

export function TagAnalyticsCard({ results }: TagAnalyticsCardProps) {
  const nextIdRef = useRef(1)
  const createId = useCallback(() => `b${nextIdRef.current++}`, [])

  // 初期状態：タグが1つ以上あれば各タグを系列に、なければ合計1つ
  const [seriesList, setSeriesList] = useState<BarSeriesConfig[]>(() => {
    const tagSet = new Set<string>()
    results.forEach((examResult) =>
      examResult.tags.forEach((tag) => tagSet.add(tag))
    )
    const tags = Array.from(tagSet).sort()

    if (tags.length > 0) {
      return tags.map((tag, i) => ({
        id: `b${nextIdRef.current++}`,
        label: tag,
        tags: new Set([tag]),
        subtotalId: "__total__",
        color: SERIES_COLORS[i % SERIES_COLORS.length],
      }))
    }
    return [
      {
        id: createId(),
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

  // グループ化した小計一覧
  const subtotalGroups = useMemo(() => {
    const groups = new Map<string, SubtotalOption[]>()
    for (const option of subtotalOptions) {
      const list = groups.get(option.groupName) || []
      list.push(option)
      groups.set(option.groupName, list)
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
        const matchedOption = subtotalOptions.find(
          (option) => option.id === subtotalId
        )
        if (matchedOption) parts.push(matchedOption.label)
      } else if (tags.size === 0) {
        parts.push("合計")
      }
      return parts.join(" / ")
    },
    [subtotalOptions]
  )

  const addSeries = useCallback(() => {
    setSeriesList((prev) => {
      const colorIndex = prev.length % SERIES_COLORS.length
      return [
        ...prev,
        {
          id: createId(),
          label: "合計",
          tags: new Set<string>(),
          subtotalId: "__total__",
          color: SERIES_COLORS[colorIndex],
        },
      ]
    })
  }, [createId])

  const removeSeries = useCallback((seriesId: string) => {
    setSeriesList((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((series) => series.id !== seriesId)
    })
  }, [])

  const toggleSeriesTag = useCallback(
    (seriesId: string, tag: string) => {
      setSeriesList((prev) =>
        prev.map((series) => {
          if (series.id !== seriesId) return series
          const next = new Set(series.tags)
          if (next.has(tag)) next.delete(tag)
          else next.add(tag)
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

  // 棒グラフデータ生成
  const chartData = useMemo(() => {
    return seriesList.map((series) => {
      const scored = results.filter(
        (examResult) =>
          (examResult.status === "complete" ||
            examResult.status === "partial") &&
          (series.tags.size === 0 ||
            examResult.tags.some((tag) => series.tags.has(tag)))
      )

      let totalRate = 0
      let count = 0

      for (const examResult of scored) {
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

  if (
    results.filter((examResult) => examResult.status !== "unscored").length ===
    0
  ) {
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
              tickFormatter={(tickValue) => `${tickValue}%`}
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
                const barData = payload[0].payload as {
                  label: string
                  avgRate: number
                  examCount: number
                }
                return (
                  <div className="bg-background rounded-lg border px-3 py-2 shadow-md">
                    <p className="text-sm font-medium">{barData.label}</p>
                    <p className="mt-1 text-sm tabular-nums">
                      平均得点率：
                      <span className="font-semibold">{barData.avgRate}%</span>
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {barData.examCount}回の試験
                    </p>
                  </div>
                )
              }}
            />
            <Bar dataKey="avgRate" radius={[0, 4, 4, 0]} barSize={28}>
              {chartData.map((barData) => (
                <Cell key={barData.id} fill={barData.color} opacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
