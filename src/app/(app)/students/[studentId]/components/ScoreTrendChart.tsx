"use client"

import { useCallback, useMemo } from "react"

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
import type { StudentExamResult } from "@/electron-src/lib/prisma/student"

/**
 * 生徒の推移の1点（試験日1つ）。系列ごとに `<系列id>` へ得点率（整数%）、
 * `<系列id>_score` / `<系列id>_max` へ得点と満点を持つ
 */
interface StudentTrendPoint extends TrendChartPointBase {
  [seriesKey: string]: number | string
}

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

  // チャートデータ生成 — 全系列を統合した横持ちデータ
  const { mergedData, hasData } = useMemo(() => {
    // 各試験日のデータを統合
    const dateMap = new Map<number, StudentTrendPoint>()

    for (const series of seriesList) {
      for (const examResult of results) {
        if (!examResult.referenceDate) continue
        if (!isSeriesExam(examResult, series.tags)) continue
        const seriesScore = seriesScoreOf(examResult, series.subtotalId)
        if (!seriesScore) continue
        const { score, maxScore } = seriesScore

        const key = new Date(examResult.referenceDate).getTime()
        const rate = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0

        const entry = dateMap.get(key) ?? {
          date: formatShortDate(examResult.referenceDate),
          sortKey: key,
          examName: examResult.examName,
        }
        dateMap.set(key, entry)
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
      data={mergedData}
      hasData={hasData}
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
