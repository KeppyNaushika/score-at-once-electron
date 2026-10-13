"use client"

import { useCallback, useMemo } from "react"
import { Area } from "recharts"

import { SERIES_COLORS } from "@/components/score-trend/scoreTrendOptions"
import { TrendChartFrame } from "@/components/score-trend/TrendChartFrame"
import { buildClassroomTrendPoints } from "@/components/score-trend/trendPoints"
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

  // チャートデータ生成 — 試験ごとに1点（値のある試験だけ）
  const trendPoints = useMemo(
    () => buildClassroomTrendPoints(studentResults, seriesList),
    [studentResults, seriesList]
  )

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
      data={trendPoints}
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
