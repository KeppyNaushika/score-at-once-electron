import { BoxPlotLegend } from "./BoxPlotLegend"
import { BoxPlotRow, type BoxPlotVisibility } from "./BoxPlotRow"
import type { ComputedSubtotalStat } from "./computeReportData"

interface BoxPlotChartViewProps extends BoxPlotVisibility {
  subtotalStats: ComputedSubtotalStat[]
  getStudentScore: (subtotalId: string) => number
  fontScale: number
  boxPlotFontSize: number
  boxPlotItemHeight: number
}

/**
 * 純粋ビューコンポーネント（hooks不使用）
 * プレビューとPDF出力の両方で使用
 */
export function BoxPlotChartView({
  subtotalStats,
  getStudentScore,
  fontScale,
  showMin,
  showQ1,
  showMedian,
  showQ3,
  showMax,
  showAverageLine,
  showStudentMarker,
  boxPlotFontSize,
  boxPlotItemHeight,
}: BoxPlotChartViewProps) {
  if (subtotalStats.length === 0) return null

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
      {subtotalStats.map((stat, index) => (
        <BoxPlotRow
          key={stat.subtotalId}
          stat={stat}
          y={marginTop + index * rowHeight}
          boxHeight={boxHeight}
          marginLeft={marginLeft}
          plotWidth={plotWidth}
          chartWidth={chartWidth}
          studentScore={getStudentScore(stat.subtotalId)}
          fontScale={fontScale}
          boxPlotFontSize={boxPlotFontSize}
          showMin={showMin}
          showQ1={showQ1}
          showMedian={showMedian}
          showQ3={showQ3}
          showMax={showMax}
          showAverageLine={showAverageLine}
          showStudentMarker={showStudentMarker}
        />
      ))}

      {/* 凡例 */}
      <BoxPlotLegend
        x={marginLeft}
        y={chartHeight - 8}
        fontScale={fontScale}
        boxPlotFontSize={boxPlotFontSize}
        showQ1={showQ1}
        showMedian={showMedian}
        showQ3={showQ3}
        showAverageLine={showAverageLine}
        showStudentMarker={showStudentMarker}
      />
    </svg>
  )
}
