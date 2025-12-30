/**
 * グラフセクションコンポーネント
 * 棒グラフ、レーダーチャート、箱ひげ図をSVGで描画
 */
import { Text, View, Svg, Rect, Line, Circle, Path, G } from "@react-pdf/renderer"
import type {
  IndividualReportData,
  IndividualReportOptions,
} from "@/electron-src/lib/export/individual-report/types"
import { styles, colors } from "./styles"

interface ChartSectionProps {
  report: IndividualReportData
  options: IndividualReportOptions
}

export function ChartSection({ report, options }: ChartSectionProps) {
  const { graphOptions } = options
  const subtotalScores = report.scoringData.subtotalScores

  if (subtotalScores.length === 0) return null

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>グラフ</Text>
      <View style={styles.chartArea}>
        {graphOptions.showBarChart && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>小計別得点率</Text>
            <BarChart
              data={subtotalScores}
              average={report.statistics.overall.average}
              maxTotal={report.scoringData.totalMaxScore}
              showAverageLine={graphOptions.showAverageLine}
            />
          </View>
        )}
        {graphOptions.showBoxPlot && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>得点分布</Text>
            <BoxPlotChart
              boxPlot={report.statistics.overall.boxPlot}
              yourScore={report.scoringData.totalScore}
              maxScore={report.scoringData.totalMaxScore}
            />
          </View>
        )}
        {graphOptions.showRadarChart && subtotalScores.length >= 3 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>レーダーチャート</Text>
            <RadarChart
              data={subtotalScores}
              statistics={report.statistics.subtotalStatistics}
              showAverageLine={graphOptions.showAverageLine}
            />
          </View>
        )}
      </View>
    </View>
  )
}

// 棒グラフ
interface BarChartProps {
  data: { subtotalLabel: string; score: number; maxScore: number }[]
  average: number
  maxTotal: number
  showAverageLine: boolean
}

function BarChart({ data, average, maxTotal, showAverageLine }: BarChartProps) {
  const width = 150
  const height = 100
  const barWidth = Math.min(20, (width - 20) / data.length - 4)
  const maxBarHeight = height - 30

  return (
    <Svg width={width} height={height}>
      {/* 背景グリッド */}
      <Line x1={10} y1={height - 15} x2={width - 10} y2={height - 15} stroke="#ccc" strokeWidth={0.5} />
      <Line x1={10} y1={height - 15 - maxBarHeight / 2} x2={width - 10} y2={height - 15 - maxBarHeight / 2} stroke="#eee" strokeWidth={0.5} />

      {/* 棒グラフ */}
      {data.map((item, index) => {
        const rate = item.maxScore > 0 ? item.score / item.maxScore : 0
        const barHeight = rate * maxBarHeight
        const x = 15 + index * ((width - 30) / data.length)
        const y = height - 15 - barHeight

        return (
          <G key={index}>
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={colors.primary}
            />
          </G>
        )
      })}

      {/* 平均線 */}
      {showAverageLine && (
        <Line
          x1={10}
          y1={height - 15 - (average / maxTotal) * maxBarHeight}
          x2={width - 10}
          y2={height - 15 - (average / maxTotal) * maxBarHeight}
          stroke={colors.incorrect}
          strokeWidth={1}
          strokeDasharray="3,3"
        />
      )}
    </Svg>
  )
}

// 箱ひげ図
interface BoxPlotChartProps {
  boxPlot: { min: number; q1: number; median: number; q3: number; max: number }
  yourScore: number
  maxScore: number
}

function BoxPlotChart({ boxPlot, yourScore, maxScore }: BoxPlotChartProps) {
  const width = 150
  const height = 80
  const plotWidth = width - 40
  const centerY = height / 2

  const scale = (value: number) => 20 + (value / maxScore) * plotWidth

  const minX = scale(boxPlot.min)
  const q1X = scale(boxPlot.q1)
  const medianX = scale(boxPlot.median)
  const q3X = scale(boxPlot.q3)
  const maxX = scale(boxPlot.max)
  const yourX = scale(yourScore)

  return (
    <Svg width={width} height={height}>
      {/* 軸 */}
      <Line x1={20} y1={height - 10} x2={width - 20} y2={height - 10} stroke="#ccc" strokeWidth={0.5} />

      {/* ひげ（min-q1, q3-max） */}
      <Line x1={minX} y1={centerY} x2={q1X} y2={centerY} stroke="#666" strokeWidth={1} />
      <Line x1={q3X} y1={centerY} x2={maxX} y2={centerY} stroke="#666" strokeWidth={1} />

      {/* 端点 */}
      <Line x1={minX} y1={centerY - 8} x2={minX} y2={centerY + 8} stroke="#666" strokeWidth={1} />
      <Line x1={maxX} y1={centerY - 8} x2={maxX} y2={centerY + 8} stroke="#666" strokeWidth={1} />

      {/* 箱（q1-q3） */}
      <Rect x={q1X} y={centerY - 15} width={q3X - q1X} height={30} fill="#e0e7ff" stroke="#6366f1" strokeWidth={1} />

      {/* 中央値 */}
      <Line x1={medianX} y1={centerY - 15} x2={medianX} y2={centerY + 15} stroke="#6366f1" strokeWidth={2} />

      {/* あなたの得点 */}
      <Circle cx={yourX} cy={centerY} r={5} fill={colors.primary} />
      <Text x={yourX} y={centerY - 20} style={{ fontSize: 7, textAnchor: "middle" }}>
        あなた
      </Text>
    </Svg>
  )
}

// レーダーチャート
interface RadarChartProps {
  data: { subtotalLabel: string; score: number; maxScore: number }[]
  statistics: { subtotalId: string; average: number }[]
  showAverageLine: boolean
}

function RadarChart({ data, statistics: _statistics, showAverageLine: _showAverageLine }: RadarChartProps) {
  const width = 150
  const height = 100
  const centerX = width / 2
  const centerY = height / 2
  const radius = 35

  const n = data.length
  if (n < 3) return null

  // 頂点座標を計算
  const getPoint = (index: number, value: number, maxValue: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2
    const r = maxValue > 0 ? (value / maxValue) * radius : 0
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    }
  }

  // パスを生成
  const createPath = (values: number[], maxValues: number[]) => {
    const points = values.map((v, i) => getPoint(i, v, maxValues[i]))
    return points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ") + " Z"
  }

  const yourPath = createPath(
    data.map((d) => d.score),
    data.map((d) => d.maxScore)
  )

  // 背景の正多角形（外枠）
  const outerPoints = data.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) }
  })
  const outerPath = outerPoints.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ") + " Z"

  return (
    <Svg width={width} height={height}>
      {/* 背景グリッド */}
      <Path d={outerPath} fill="none" stroke="#ddd" strokeWidth={0.5} />
      {outerPoints.map((p, i) => (
        <Line key={i} x1={centerX} y1={centerY} x2={p.x} y2={p.y} stroke="#eee" strokeWidth={0.5} />
      ))}

      {/* あなたのデータ */}
      <Path d={yourPath} fill="rgba(59, 130, 246, 0.3)" stroke={colors.primary} strokeWidth={1.5} />

      {/* 頂点のドット */}
      {data.map((d, i) => {
        const point = getPoint(i, d.score, d.maxScore)
        return <Circle key={i} cx={point.x} cy={point.y} r={3} fill={colors.primary} />
      })}
    </Svg>
  )
}
