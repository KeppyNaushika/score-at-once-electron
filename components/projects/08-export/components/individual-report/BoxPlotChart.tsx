"use client"

/**
 * 箱ひげ図コンポーネント
 * SVGで描画し、印刷時もきれいにスケール
 * renderer側で欠席生徒の除外オプションに基づいて統計を再計算
 */
import type {
  BoxPlotData,
  StatisticsData,
  SubtotalGroupSelection,
  SubtotalRawScores,
} from "@/electron-src/lib/export/individual-report/types"
import type { ScoringData } from "@/electron-src/lib/shared/types/exportTypes"
import { useMemo } from "react"

/** 受験状態フィルタ */
interface BoxPlotIncludeStatuses {
  participating: boolean
  expected: boolean
  absent: boolean
}

interface BoxPlotChartProps {
  statistics: StatisticsData
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
}

/**
 * 配列の中央値を計算
 */
function calculateMedian(sortedValues: number[]): number {
  const n = sortedValues.length
  if (n === 0) return 0
  if (n === 1) return sortedValues[0]

  const mid = Math.floor(n / 2)
  if (n % 2 === 0) {
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2
  } else {
    return sortedValues[mid]
  }
}

/**
 * 配列の平均値を計算
 */
function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * 箱ひげ図データを計算（Tukey法）
 */
function calculateBoxPlotData(values: number[]): BoxPlotData {
  if (values.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0 }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length

  const min = sorted[0]
  const max = sorted[n - 1]
  const median = calculateMedian(sorted)

  const midIndex = Math.floor(n / 2)
  const lowerHalf = sorted.slice(0, midIndex)
  const upperHalf = sorted.slice(n % 2 === 0 ? midIndex : midIndex + 1)

  const q1 = calculateMedian(lowerHalf)
  const q3 = calculateMedian(upperHalf)

  return { min, q1, median, q3, max }
}

/**
 * 小計ごとの統計データを計算（受験状態フィルタ対応）
 */
interface ComputedSubtotalStat {
  subtotalId: string
  subtotalLabel: string
  subtotalGroupId: string
  boxPlot: BoxPlotData
  average: number
  maxScore: number
}

const DEFAULT_INCLUDE_STATUSES: BoxPlotIncludeStatuses = {
  participating: true,
  expected: true,
  absent: true,
}

function computeSubtotalStats(
  rawScores: SubtotalRawScores[],
  subtotalStatistics: StatisticsData["subtotalStatistics"],
  includeStatuses: BoxPlotIncludeStatuses
): ComputedSubtotalStat[] {
  // 全て含める場合は元の統計をそのまま使用
  const includeAll =
    includeStatuses.participating &&
    includeStatuses.expected &&
    includeStatuses.absent

  return subtotalStatistics.map((stat) => {
    const rawData = rawScores.find((r) => r.subtotalId === stat.subtotalId)

    if (!rawData || includeAll) {
      // 生データがないか、全て含める場合は元の統計をそのまま使用
      return {
        subtotalId: stat.subtotalId,
        subtotalLabel: stat.subtotalLabel,
        subtotalGroupId: stat.subtotalGroupId,
        boxPlot: stat.boxPlot,
        average: stat.average,
        maxScore: stat.maxScore,
      }
    }

    // 選択された受験状態のみでスコア配列を作成
    const filteredScores = rawData.scores
      .filter((s) => {
        if (s.status === "participating") return includeStatuses.participating
        if (s.status === "expected") return includeStatuses.expected
        if (s.status === "absent") return includeStatuses.absent
        return true
      })
      .map((s) => s.score)

    if (filteredScores.length === 0) {
      return {
        subtotalId: stat.subtotalId,
        subtotalLabel: stat.subtotalLabel,
        subtotalGroupId: stat.subtotalGroupId,
        boxPlot: { min: 0, q1: 0, median: 0, q3: 0, max: 0 },
        average: 0,
        maxScore: stat.maxScore,
      }
    }

    return {
      subtotalId: stat.subtotalId,
      subtotalLabel: stat.subtotalLabel,
      subtotalGroupId: stat.subtotalGroupId,
      boxPlot: calculateBoxPlotData(filteredScores),
      average: calculateAverage(filteredScores),
      maxScore: stat.maxScore,
    }
  })
}

export function BoxPlotChart({
  statistics,
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
}: BoxPlotChartProps) {
  // renderer側で統計を再計算（受験状態フィルタ対応）
  const computedStats = useMemo(() => {
    return computeSubtotalStats(
      statistics.subtotalRawScores || [],
      statistics.subtotalStatistics,
      boxPlotIncludeStatuses
    )
  }, [
    statistics.subtotalRawScores,
    statistics.subtotalStatistics,
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
        (s) =>
          !s.subtotalGroupId ||
          subtotalGroupSelection.selectedGroupIds.includes(s.subtotalGroupId)
      )
    }

    // 設問と関連付けのない小計点を非表示
    if (hideUnassignedSubtotals) {
      const assignedSubtotalIds = new Set(
        scoringData.subtotalScores
          .filter((s) => s.hasQuestionAssignments)
          .map((s) => s.subtotalId)
      )
      stats = stats.filter((s) => assignedSubtotalIds.has(s.subtotalId))
    }

    return stats
  }, [
    computedStats,
    subtotalGroupSelection,
    hideUnassignedSubtotals,
    scoringData.subtotalScores,
  ])

  if (subtotalStats.length === 0) return null

  // チャート設定
  // boxHeight: フォントサイズに基づく（fontSize * 1.8）
  // itemSpacing: 項目間の間隔
  // rowHeight: boxHeight + itemSpacing
  const boxHeight = boxPlotFontSize * 1.8
  const itemSpacing = boxPlotItemHeight
  const rowHeight = boxHeight + itemSpacing

  const chartWidth = 500
  const legendHeight = 20
  const chartHeight = 40 + subtotalStats.length * rowHeight + legendHeight
  const marginLeft = 100
  const marginRight = 60
  const marginTop = 30
  const plotWidth = chartWidth - marginLeft - marginRight

  // 各小計の得点を取得
  const getStudentScore = (subtotalId: string): number => {
    const subtotal = scoringData.subtotalScores.find(
      (s) => s.subtotalId === subtotalId
    )
    return subtotal?.score ?? 0
  }

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      style={{
        width: "100%",
        height: "auto",
        maxHeight: `${chartHeight}px`,
      }}
    >
      {/* ヘッダー */}
      <text
        x={marginLeft}
        y={15}
        fontSize={10 * fontScale}
        fill="#666"
        textAnchor="start"
      >
        0%
      </text>
      <text
        x={marginLeft + plotWidth / 2}
        y={15}
        fontSize={10 * fontScale}
        fill="#666"
        textAnchor="middle"
      >
        50%
      </text>
      <text
        x={marginLeft + plotWidth}
        y={15}
        fontSize={10 * fontScale}
        fill="#666"
        textAnchor="end"
      >
        100%
      </text>

      {/* グリッド線 */}
      <line
        x1={marginLeft}
        y1={marginTop}
        x2={marginLeft}
        y2={chartHeight - legendHeight - 10}
        stroke="#e0e0e0"
        strokeWidth={1}
      />
      <line
        x1={marginLeft + plotWidth / 2}
        y1={marginTop}
        x2={marginLeft + plotWidth / 2}
        y2={chartHeight - legendHeight - 10}
        stroke="#e0e0e0"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <line
        x1={marginLeft + plotWidth}
        y1={marginTop}
        x2={marginLeft + plotWidth}
        y2={chartHeight - legendHeight - 10}
        stroke="#e0e0e0"
        strokeWidth={1}
      />

      {/* 各小計の箱ひげ図 */}
      {subtotalStats.map((stat, index) => {
        const y = marginTop + index * rowHeight
        const boxPlot = stat.boxPlot

        // 最大得点 = boxPlot.max（全生徒の最高得点 = 満点の生徒がいれば満点）
        const maxScore = boxPlot.max || 100

        // 得点率に変換
        const toPercent = (score: number) => (score / maxScore) * 100
        const toX = (percent: number) =>
          marginLeft + (percent / 100) * plotWidth

        const minX = toX(toPercent(boxPlot.min))
        const q1X = toX(toPercent(boxPlot.q1))
        const medianX = toX(toPercent(boxPlot.median))
        const q3X = toX(toPercent(boxPlot.q3))
        const maxX = toX(toPercent(boxPlot.max))

        // 生徒の得点位置
        const studentScore = getStudentScore(stat.subtotalId)
        const studentX = toX(toPercent(studentScore))

        return (
          <g key={stat.subtotalId}>
            {/* ラベル */}
            <text
              x={marginLeft - 8}
              y={y + boxHeight / 2 + 4}
              fontSize={boxPlotFontSize * fontScale}
              fill="#333"
              textAnchor="end"
            >
              {stat.subtotalLabel.length > 12
                ? stat.subtotalLabel.substring(0, 12) + "..."
                : stat.subtotalLabel}
            </text>

            {/* 最小から最も近い表示要素への水平線 */}
            {showMin &&
              (() => {
                // 最小の次に表示される要素を探す
                const targetX = showQ1
                  ? q1X
                  : showMedian
                    ? medianX
                    : showQ3
                      ? q3X
                      : showMax
                        ? maxX
                        : null
                if (targetX === null) return null
                return (
                  <line
                    x1={minX}
                    y1={y + boxHeight / 2}
                    x2={targetX}
                    y2={y + boxHeight / 2}
                    stroke="#666"
                    strokeWidth={1}
                  />
                )
              })()}

            {/* 最小のひげ */}
            {showMin && (
              <line
                x1={minX}
                y1={y + 4}
                x2={minX}
                y2={y + boxHeight - 4}
                stroke="#666"
                strokeWidth={1}
              />
            )}

            {/* Q1-Median間の塗りつぶし */}
            {showQ1 && showMedian && (
              <rect
                x={q1X}
                y={y}
                width={Math.max(medianX - q1X, 1)}
                height={boxHeight}
                fill="#e0e7ff"
                stroke="none"
              />
            )}

            {/* Median-Q3間の塗りつぶし */}
            {showMedian && showQ3 && (
              <rect
                x={medianX}
                y={y}
                width={Math.max(q3X - medianX, 1)}
                height={boxHeight}
                fill="#e0e7ff"
                stroke="none"
              />
            )}

            {/* Q1-Q3間の塗りつぶし（Medianなしの場合） */}
            {showQ1 && showQ3 && !showMedian && (
              <rect
                x={q1X}
                y={y}
                width={Math.max(q3X - q1X, 1)}
                height={boxHeight}
                fill="#e0e7ff"
                stroke="none"
              />
            )}

            {/* Q1の線 */}
            {showQ1 && (
              <line
                x1={q1X}
                y1={y}
                x2={q1X}
                y2={y + boxHeight}
                stroke="#6366f1"
                strokeWidth={1.5}
              />
            )}

            {/* 中央値の線 */}
            {showMedian && (
              <line
                x1={medianX}
                y1={y}
                x2={medianX}
                y2={y + boxHeight}
                stroke="#4f46e5"
                strokeWidth={2}
              />
            )}

            {/* Q3の線 */}
            {showQ3 && (
              <line
                x1={q3X}
                y1={y}
                x2={q3X}
                y2={y + boxHeight}
                stroke="#6366f1"
                strokeWidth={1.5}
              />
            )}

            {/* 平均値 */}
            {showAverageLine && (
              <line
                x1={toX(toPercent(stat.average))}
                y1={y - 2}
                x2={toX(toPercent(stat.average))}
                y2={y + boxHeight + 2}
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="3 2"
              />
            )}

            {/* 最も近い表示要素から最大への水平線 */}
            {showMax &&
              (() => {
                // 最大の手前に表示される要素を探す
                const targetX = showQ3
                  ? q3X
                  : showMedian
                    ? medianX
                    : showQ1
                      ? q1X
                      : showMin
                        ? minX
                        : null
                if (targetX === null) return null
                return (
                  <line
                    x1={targetX}
                    y1={y + boxHeight / 2}
                    x2={maxX}
                    y2={y + boxHeight / 2}
                    stroke="#666"
                    strokeWidth={1}
                  />
                )
              })()}

            {/* 最大のひげ */}
            {showMax && (
              <line
                x1={maxX}
                y1={y + 4}
                x2={maxX}
                y2={y + boxHeight - 4}
                stroke="#666"
                strokeWidth={1}
              />
            )}

            {/* 生徒の得点マーカー */}
            {showStudentMarker && (
              <>
                <circle
                  cx={studentX}
                  cy={y + boxHeight / 2}
                  r={Math.max(4, boxHeight / 4)}
                  fill="#ef4444"
                  stroke="#fff"
                  strokeWidth={2}
                />
                <text
                  x={chartWidth - 10}
                  y={y + boxHeight / 2 + 4}
                  fontSize={(boxPlotFontSize - 1) * fontScale}
                  fill="#333"
                  textAnchor="end"
                >
                  {studentScore}点
                </text>
              </>
            )}
          </g>
        )
      })}

      {/* 凡例 */}
      <g transform={`translate(${marginLeft}, ${chartHeight - 8})`}>
        {(() => {
          let xOffset = 0
          const legendFontSize = (boxPlotFontSize - 2) * fontScale

          // 範囲ラベルを動的に生成
          const getRangeLabel = (): string | null => {
            // 塗りつぶしが表示される条件に基づいてラベルを決定
            if (showQ1 && showMedian && showQ3) return "Q1-Q3範囲"
            if (showQ1 && showMedian && !showQ3) return "Q1-中央値範囲"
            if (!showQ1 && showMedian && showQ3) return "中央値-Q3範囲"
            if (showQ1 && !showMedian && showQ3) return "Q1-Q3範囲"
            return null // 塗りつぶしなし
          }
          const rangeLabel = getRangeLabel()

          const elements: React.ReactNode[] = []

          if (showStudentMarker) {
            elements.push(
              <g key="student" transform={`translate(${xOffset}, 0)`}>
                <circle cx={0} cy={0} r={4} fill="#ef4444" />
                <text x={8} y={4} fontSize={legendFontSize} fill="#666">
                  あなたの得点
                </text>
              </g>
            )
            xOffset += 80
          }

          if (rangeLabel) {
            elements.push(
              <g key="range" transform={`translate(${xOffset}, 0)`}>
                <rect
                  x={0}
                  y={-6}
                  width={12}
                  height={12}
                  fill="#e0e7ff"
                  stroke="#6366f1"
                />
                <text x={16} y={4} fontSize={legendFontSize} fill="#666">
                  {rangeLabel}
                </text>
              </g>
            )
            xOffset += 80
          }

          if (showMedian) {
            elements.push(
              <g key="median" transform={`translate(${xOffset}, 0)`}>
                <line
                  x1={0}
                  y1={0}
                  x2={10}
                  y2={0}
                  stroke="#4f46e5"
                  strokeWidth={2}
                />
                <text x={14} y={4} fontSize={legendFontSize} fill="#666">
                  中央値
                </text>
              </g>
            )
            xOffset += 60
          }

          if (showAverageLine) {
            elements.push(
              <g key="average" transform={`translate(${xOffset}, 0)`}>
                <line
                  x1={0}
                  y1={0}
                  x2={15}
                  y2={0}
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="3 2"
                />
                <text x={19} y={4} fontSize={legendFontSize} fill="#666">
                  平均
                </text>
              </g>
            )
          }

          return elements
        })()}
      </g>
    </svg>
  )
}
