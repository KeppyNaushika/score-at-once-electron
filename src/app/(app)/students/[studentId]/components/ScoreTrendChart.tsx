"use client"

import { useCallback, useMemo } from "react"

import { SERIES_COLORS } from "@/components/score-trend/scoreTrendOptions"
import { TrendChartFrame } from "@/components/score-trend/TrendChartFrame"
import { buildStudentTrendPoints } from "@/components/score-trend/trendPoints"
import { TrendSeriesEditor } from "@/components/score-trend/TrendSeriesEditor"
import {
  TOTAL_SUBTOTAL_ID,
  type TrendSeries,
} from "@/components/score-trend/types"
import { useTrendFilterOptions } from "@/components/score-trend/useTrendFilterOptions"
import { useTrendSeriesList } from "@/components/score-trend/useTrendSeriesList"
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
  const { allTags, subtotalOptions, subtotalGroups } =
    useTrendFilterOptions(results)

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

  // チャートデータ生成 — 試験ごとに1点、全系列を統合した横持ちデータ
  const trendPoints = useMemo(
    () => buildStudentTrendPoints(results, seriesList),
    [results, seriesList]
  )

  if (results.length === 0) {
    return null
  }

  return (
    <TrendChartFrame
      header={
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
      }
      data={trendPoints}
      seriesList={seriesList}
      renderTooltipValue={(series, point) => {
        const rate = point[series.id]
        if (rate == null) return null
        return (
          <span className="ml-auto font-semibold tabular-nums">
            {point[`${series.id}_score`]} / {point[`${series.id}_max`]} 点（
            {rate}
            %）
          </span>
        )
      }}
      singlePointMessage={
        <p>
          データが1件のみです。複数の試験結果があると推移グラフが表示されます
        </p>
      }
      emptyMessage="表示条件に一致する採点済みの試験がありません"
    />
  )
}
