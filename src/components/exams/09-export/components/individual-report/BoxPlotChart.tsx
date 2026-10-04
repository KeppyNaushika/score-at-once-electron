"use client"

/**
 * 箱ひげ図コンポーネント
 * SVGで描画し、印刷時もきれいにスケール
 * renderer側で欠席生徒の除外オプションに基づいて統計を再計算
 *
 * BoxPlotChart: hooks付きラッパー（プレビュー用）
 * BoxPlotChartView: 純粋ビュー（プレビュー＋PDF出力共用）
 */
import { useMemo } from "react"

import type { ScoringData } from "@/electron-src/lib/shared/types"
import type {
  ReportPopulation,
  SubtotalGroupSelection,
} from "@/types/individualReport.types"

import { BoxPlotChartView } from "./BoxPlotChartView"
import {
  type BoxPlotIncludeStatuses,
  type ComputedSubtotalStat,
  computeFilteredClassroomStats,
  computeFilteredOverallStat,
  computeFilteredSubtotalStats,
  isTotalScoreStat,
  selectStudentClassrooms,
} from "./computeReportData"

const DEFAULT_INCLUDE_STATUSES: BoxPlotIncludeStatuses = {
  participating: true,
  expected: true,
  absent: true,
}

interface BoxPlotChartProps {
  population: ReportPopulation
  scoringData: ScoringData
  fontScale: number
  showMin?: boolean
  showQ1?: boolean
  showMedian?: boolean
  showQ3?: boolean
  showMax?: boolean
  showAverageLine?: boolean
  showStudentMarker?: boolean
  subtotalGroupSelection?: SubtotalGroupSelection
  hideUnassignedSubtotals?: boolean
  boxPlotIncludeStatuses?: BoxPlotIncludeStatuses
  boxPlotFontSize?: number
  boxPlotItemHeight?: number
  /** 合計点の箱ひげ図を先頭に足す */
  showTotalScoreBoxPlot?: boolean
  /** 所属学級ごとの合計点箱ひげ図を足す */
  showClassroomBoxPlot?: boolean
}

/**
 * hooks付きラッパー（プレビュー用）
 */
export function BoxPlotChart({
  population,
  scoringData,
  fontScale,
  showMin = true,
  showQ1 = true,
  showMedian = true,
  showQ3 = true,
  showMax = true,
  showAverageLine = true,
  showStudentMarker = true,
  subtotalGroupSelection,
  hideUnassignedSubtotals,
  boxPlotIncludeStatuses = DEFAULT_INCLUDE_STATUSES,
  boxPlotFontSize = 11,
  boxPlotItemHeight = 50,
  showTotalScoreBoxPlot = false,
  showClassroomBoxPlot = false,
}: BoxPlotChartProps) {
  // renderer側で統計を算出（受験状態フィルタ対応）
  const computedStats = useMemo(() => {
    return computeFilteredSubtotalStats(
      population.subtotalRawScores,
      population.subtotals,
      boxPlotIncludeStatuses
    )
  }, [
    population.subtotalRawScores,
    population.subtotals,
    boxPlotIncludeStatuses,
  ])

  // フィルタリング適用
  const subtotalStats = useMemo(() => {
    let stats = computedStats

    // グループ選択でフィルタリング
    if (
      subtotalGroupSelection?.enabled &&
      subtotalGroupSelection.selectedGroupIds.length > 0
    ) {
      stats = stats.filter(
        (subtotalStat) =>
          !subtotalStat.subtotalGroupId ||
          subtotalGroupSelection.selectedGroupIds.includes(
            subtotalStat.subtotalGroupId
          )
      )
    }

    // 設問と関連付けのない小計点を非表示
    if (hideUnassignedSubtotals) {
      const assignedSubtotalIds = new Set(
        scoringData.subtotalScores
          .filter((subtotalScore) => subtotalScore.hasQuestionAssignments)
          .map((subtotalScore) => subtotalScore.subtotalId)
      )
      stats = stats.filter((subtotalStat) =>
        assignedSubtotalIds.has(subtotalStat.subtotalId)
      )
    }

    return stats
  }, [
    computedStats,
    subtotalGroupSelection,
    hideUnassignedSubtotals,
    scoringData.subtotalScores,
  ])

  // 合計点の箱ひげ図データ
  const overallStat = useMemo(() => {
    if (!showTotalScoreBoxPlot) return null
    return computeFilteredOverallStat(
      population.rawTotalScores,
      scoringData.totalMaxScore,
      boxPlotIncludeStatuses
    )
  }, [
    showTotalScoreBoxPlot,
    population.rawTotalScores,
    scoringData.totalMaxScore,
    boxPlotIncludeStatuses,
  ])

  // 学級ごとの合計点箱ひげ図（本人の所属学級それぞれ）
  const classroomStats = useMemo(() => {
    if (!showClassroomBoxPlot) return []
    return computeFilteredClassroomStats(
      population.rawTotalScores,
      selectStudentClassrooms(population.classrooms, scoringData.studentId),
      scoringData.totalMaxScore,
      boxPlotIncludeStatuses
    )
  }, [
    showClassroomBoxPlot,
    population.rawTotalScores,
    population.classrooms,
    scoringData.studentId,
    scoringData.totalMaxScore,
    boxPlotIncludeStatuses,
  ])

  // 全項目を合成: [合計点] + [学級ごと] + [小計別]
  const allStats = useMemo(() => {
    const items: ComputedSubtotalStat[] = []
    if (overallStat) items.push(overallStat)
    items.push(...classroomStats)
    items.push(...subtotalStats)
    return items
  }, [overallStat, classroomStats, subtotalStats])

  if (allStats.length === 0) return null

  // 各項目の得点を取得
  const getStudentScore = (id: string): number => {
    if (isTotalScoreStat(id)) {
      return scoringData.totalScore ?? 0
    }
    const subtotal = scoringData.subtotalScores.find(
      (subtotalScore) => subtotalScore.subtotalId === id
    )
    return subtotal?.score ?? 0
  }

  return (
    <BoxPlotChartView
      subtotalStats={allStats}
      getStudentScore={getStudentScore}
      fontScale={fontScale}
      showMin={showMin}
      showQ1={showQ1}
      showMedian={showMedian}
      showQ3={showQ3}
      showMax={showMax}
      showAverageLine={showAverageLine}
      showStudentMarker={showStudentMarker}
      boxPlotFontSize={boxPlotFontSize}
      boxPlotItemHeight={boxPlotItemHeight}
    />
  )
}
