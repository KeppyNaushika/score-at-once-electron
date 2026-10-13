"use client"

import { useCallback, useMemo } from "react"
import { Area } from "recharts"

import {
  formatShortDate,
  isSeriesExam,
  SERIES_COLORS,
  seriesScoreOf,
} from "@/components/score-trend/scoreTrendOptions"
import {
  TrendChartFrame,
  type TrendChartPointBase,
} from "@/components/score-trend/TrendChartFrame"
import { TrendSeriesEditor } from "@/components/score-trend/TrendSeriesEditor"
import {
  TOTAL_SUBTOTAL_ID,
  type TrendSeries,
} from "@/components/score-trend/types"
import { useTrendFilterOptions } from "@/components/score-trend/useTrendFilterOptions"
import { useTrendSeriesList } from "@/components/score-trend/useTrendSeriesList"
import { Badge } from "@/components/ui/badge"
import type { ClassroomStudentExamResult } from "@/electron-src/lib/prisma/student"

/** 学級の系列は平均の上下に標準偏差の帯を重ねられる */
interface ClassroomTrendSeries extends TrendSeries {
  showStdDev: boolean
}

/**
 * 学級の推移の1点（試験1つ）。系列ごとに `<系列id>` へ平均得点率、`_std` へ標準偏差、
 * `_band` へ平均±σ（0〜100 に収める）、`_n` へ人数を持つ
 */
interface ClassroomTrendPoint extends TrendChartPointBase {
  [seriesKey: string]: number | string | [number, number]
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

  const { allTags, subtotalOptions, subtotalGroups } =
    useTrendFilterOptions(examResults)

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

    const dataPoints: ClassroomTrendPoint[] = []
    let anyData = false

    for (const exam of exams) {
      const point: ClassroomTrendPoint = {
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
              isSeriesExam(examResult, series.tags)
          )
          if (!result) continue

          const seriesScore = seriesScoreOf(result, series.subtotalId)
          if (!seriesScore) continue
          const { score, maxScore } = seriesScore
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
    <TrendChartFrame
      header={
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
      }
      data={mergedData}
      hasData={hasData}
      seriesList={seriesList}
      renderTooltipValue={(series, point) => {
        const avg = point[series.id]
        if (avg == null) return null
        return (
          <>
            <span className="ml-auto font-semibold tabular-nums">
              {avg}% ±{point[`${series.id}_std`]}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              ({point[`${series.id}_n`]}名)
            </span>
          </>
        )
      }}
      singlePointMessage="複数の試験結果があると推移グラフが表示されます"
      emptyMessage="採点済みの試験がありません"
    >
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
    </TrendChartFrame>
  )
}
