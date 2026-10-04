"use client"

import { useCallback, useMemo } from "react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { ClassroomStudentExamResult } from "@/electron-src/lib/prisma/student"

/** 学級の系列は平均の上下に標準偏差の帯を重ねられる */
interface ClassroomTrendSeries extends TrendSeries {
  showStdDev: boolean
}

/** 学級の推移は色を6つで回す（生徒の推移より系列が少ない前提の配色） */
const CLASSROOM_SERIES_COLORS = SERIES_COLORS.slice(0, 6)

/** 系列を足したときの姿（合計得点率・タグ無し・帯なし） */
function createSeries(id: string, color: string): ClassroomTrendSeries {
  return {
    id,
    label: "学級平均（合計）",
    tags: new Set<string>(),
    subtotalId: TOTAL_SUBTOTAL_ID,
    color,
    showStdDev: false,
  }
}

/** 最初の1本だけは帯を出しておく */
function createInitialSeries(): ClassroomTrendSeries {
  return {
    ...createSeries("cs0", CLASSROOM_SERIES_COLORS[0]),
    showStdDev: true,
  }
}

interface ClassroomScoreTrendChartProps {
  studentResults: ClassroomStudentExamResult[]
}

export function ClassroomScoreTrendChart({
  studentResults,
}: ClassroomScoreTrendChartProps) {
  const examResults = useMemo(
    () => studentResults.flatMap((studentResult) => studentResult.examResults),
    [studentResults]
  )

  // 全タグ一覧
  const allTags = useMemo(() => collectTrendTags(examResults), [examResults])

  // 全小計一覧
  const subtotalOptions = useMemo(
    () => collectSubtotalOptions(examResults),
    [examResults]
  )

  const subtotalGroups = useMemo(
    () => groupSubtotalOptions(subtotalOptions),
    [subtotalOptions]
  )

  const buildLabel = useCallback(
    (tags: Set<string>, subtotalId: string): string => {
      const parts: string[] = ["学級平均"]
      if (tags.size > 0) parts.push(Array.from(tags).join("・"))
      if (subtotalId !== TOTAL_SUBTOTAL_ID) {
        const matchedOption = subtotalOptions.find(
          (option) => option.id === subtotalId
        )
        if (matchedOption) parts.push(matchedOption.label)
      } else if (tags.size === 0) {
        parts.push("合計")
      }
      return parts.join("（") + (parts.length > 1 ? "）" : "")
    },
    [subtotalOptions]
  )

  const {
    seriesList,
    addSeries,
    removeSeries,
    updateSeries,
    toggleTag,
    clearTags,
    setSubtotal,
  } = useTrendSeriesList({
    idPrefix: "cs",
    createInitialSeries,
    createSeries,
    colors: CLASSROOM_SERIES_COLORS,
    buildLabel,
  })

  const toggleStdDev = (seriesId: string) => {
    updateSeries(seriesId, (series) => ({
      ...series,
      showStdDev: !series.showStdDev,
    }))
  }

  // チャートデータ生成
  const { mergedData, hasData } = useMemo(() => {
    // 全試験を日付でグループ化
    const datedExamMap = new Map<
      string,
      { examId: string; examName: string; date: Date }
    >()
    studentResults.forEach((studentResult) =>
      studentResult.examResults.forEach((examResult) => {
        if (examResult.referenceDate && !datedExamMap.has(examResult.examId)) {
          datedExamMap.set(examResult.examId, {
            examId: examResult.examId,
            examName: examResult.examName,
            date: new Date(examResult.referenceDate),
          })
        }
      })
    )

    const exams = Array.from(datedExamMap.values()).sort(
      (examA, examB) => examA.date.getTime() - examB.date.getTime()
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

        for (const studentResult of studentResults) {
          const result = studentResult.examResults.find(
            (examResult) =>
              examResult.examId === exam.examId &&
              (examResult.status === "complete" ||
                examResult.status === "partial") &&
              (series.tags.size === 0 ||
                examResult.tags.some((tag) => series.tags.has(tag)))
          )
          if (!result) continue

          let score: number
          let maxScore: number
          if (series.subtotalId === TOTAL_SUBTOTAL_ID) {
            score = result.totalScore
            maxScore = result.maxScore
          } else {
            const matchedSubtotal = result.subtotalScores.find(
              (subtotalScore) => subtotalScore.subtotalId === series.subtotalId
            )
            if (!matchedSubtotal) continue
            score = matchedSubtotal.score
            maxScore = matchedSubtotal.maxScore
          }
          if (maxScore > 0) {
            rates.push((score / maxScore) * 100)
          }
        }

        if (rates.length > 0) {
          anyData = true
          const avg =
            rates.reduce((accumulator, rate) => accumulator + rate, 0) /
            rates.length
          const variance =
            rates.reduce((sum, rate) => sum + (rate - avg) ** 2, 0) /
            rates.length
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
    <Card className="mb-8 border-border/50 shadow-sm">
      <TrendSeriesEditor
        title="学級成績の推移"
        seriesList={seriesList}
        subtotalOptions={subtotalOptions}
        subtotalGroups={subtotalGroups}
        allTags={allTags}
        onAddSeries={addSeries}
        onRemoveSeries={removeSeries}
        onToggleTag={toggleTag}
        onClearTags={clearTags}
        onSetSubtotal={setSubtotal}
        renderExtraControls={(series) => (
          <Badge
            variant={series.showStdDev ? "default" : "outline"}
            className="h-5 cursor-pointer rounded-full px-2 text-[10px] font-normal"
            onClick={() => toggleStdDev(series.id)}
          >
            ±σ
          </Badge>
        )}
      />

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
                        {seriesList.map((series) => {
                          const avg = first[series.id] as number | undefined
                          if (avg == null) return null
                          const std = first[`${series.id}_std`] as number
                          const studentCount = first[`${series.id}_n`] as number
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
                                {avg}% ±{std}
                              </span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                ({studentCount}名)
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
              {seriesList
                .filter((series) => series.showStdDev)
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
          <div className="py-8 text-center text-sm text-muted-foreground">
            複数の試験結果があると推移グラフが表示されます
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            採点済みの試験がありません
          </div>
        )}
      </CardContent>
    </Card>
  )
}
