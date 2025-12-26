/**
 * 個人成績表用グラフ描画ユーティリティ
 * - 棒グラフ
 * - レーダーチャート
 * - 箱ひげ図
 */

import type { BoxPlotData, SubtotalStatistics } from "@/electron-src/lib/export/individual-report/types"

/** グラフ描画の共通設定 */
export interface ChartConfig {
  width: number
  height: number
  padding: number
  colors: {
    primary: string
    secondary: string
    average: string
    background: string
    border: string
    text: string
  }
  fontSize: number
}

/** 棒グラフ用データ */
export interface BarChartData {
  label: string
  value: number
  maxValue: number
  average?: number
}

/** レーダーチャート用データ */
export interface RadarChartData {
  label: string
  value: number
  maxValue: number
  average?: number
}

/**
 * 棒グラフを描画
 */
export function drawBarChart(
  ctx: CanvasRenderingContext2D,
  data: BarChartData[],
  x: number,
  y: number,
  config: ChartConfig,
  showAverageLine: boolean = true,
): void {
  const { width, height, padding, colors, fontSize } = config

  if (data.length === 0) return

  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2 - fontSize * 2
  const barWidth = chartWidth / data.length * 0.7
  const barGap = chartWidth / data.length * 0.3

  ctx.save()
  ctx.translate(x, y)

  // 背景
  ctx.fillStyle = colors.background
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = colors.border
  ctx.strokeRect(0, 0, width, height)

  // グラフ領域
  const graphX = padding
  const graphY = padding
  const graphWidth = chartWidth
  const graphHeight = chartHeight

  // Y軸のグリッド線（0%, 50%, 100%）
  ctx.strokeStyle = "#e5e7eb"
  ctx.lineWidth = 1
  for (let i = 0; i <= 2; i++) {
    const lineY = graphY + graphHeight * (1 - i / 2)
    ctx.beginPath()
    ctx.moveTo(graphX, lineY)
    ctx.lineTo(graphX + graphWidth, lineY)
    ctx.stroke()

    // パーセンテージラベル
    ctx.fillStyle = colors.text
    ctx.font = `${fontSize * 0.8}px sans-serif`
    ctx.textAlign = "right"
    ctx.fillText(`${i * 50}%`, graphX - 5, lineY + 4)
  }

  // 棒グラフの描画
  data.forEach((item, index) => {
    const barX = graphX + (barWidth + barGap) * index + barGap / 2
    const percentage = item.maxValue > 0 ? item.value / item.maxValue : 0
    const barHeight = graphHeight * percentage
    const barY = graphY + graphHeight - barHeight

    // 棒
    ctx.fillStyle = colors.primary
    ctx.fillRect(barX, barY, barWidth, barHeight)

    // 平均線
    if (showAverageLine && item.average !== undefined && item.maxValue > 0) {
      const avgPercentage = item.average / item.maxValue
      const avgY = graphY + graphHeight * (1 - avgPercentage)
      ctx.strokeStyle = colors.average
      ctx.lineWidth = 2
      ctx.setLineDash([5, 3])
      ctx.beginPath()
      ctx.moveTo(barX - 5, avgY)
      ctx.lineTo(barX + barWidth + 5, avgY)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // ラベル
    ctx.fillStyle = colors.text
    ctx.font = `${fontSize * 0.8}px sans-serif`
    ctx.textAlign = "center"
    ctx.fillText(
      item.label.length > 6 ? item.label.substring(0, 6) + "..." : item.label,
      barX + barWidth / 2,
      graphY + graphHeight + fontSize,
    )
  })

  ctx.restore()
}

/**
 * レーダーチャートを描画
 */
export function drawRadarChart(
  ctx: CanvasRenderingContext2D,
  data: RadarChartData[],
  x: number,
  y: number,
  config: ChartConfig,
  showAverageLine: boolean = true,
): void {
  const { width, height, padding, colors, fontSize } = config

  if (data.length < 3) return

  ctx.save()
  ctx.translate(x, y)

  // 背景
  ctx.fillStyle = colors.background
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = colors.border
  ctx.strokeRect(0, 0, width, height)

  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) / 2 - padding - fontSize

  const angleStep = (2 * Math.PI) / data.length
  const startAngle = -Math.PI / 2 // 上から開始

  // グリッド（3レベル: 33%, 66%, 100%）
  ctx.strokeStyle = "#e5e7eb"
  ctx.lineWidth = 1
  for (let level = 1; level <= 3; level++) {
    const levelRadius = (radius * level) / 3
    ctx.beginPath()
    for (let i = 0; i <= data.length; i++) {
      const angle = startAngle + angleStep * i
      const px = centerX + Math.cos(angle) * levelRadius
      const py = centerY + Math.sin(angle) * levelRadius
      if (i === 0) {
        ctx.moveTo(px, py)
      } else {
        ctx.lineTo(px, py)
      }
    }
    ctx.stroke()
  }

  // 軸線
  data.forEach((_, index) => {
    const angle = startAngle + angleStep * index
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.lineTo(
      centerX + Math.cos(angle) * radius,
      centerY + Math.sin(angle) * radius,
    )
    ctx.stroke()
  })

  // 平均値のポリゴン
  if (showAverageLine) {
    ctx.beginPath()
    ctx.strokeStyle = colors.average
    ctx.lineWidth = 2
    ctx.setLineDash([5, 3])
    data.forEach((item, index) => {
      if (item.average !== undefined && item.maxValue > 0) {
        const percentage = item.average / item.maxValue
        const angle = startAngle + angleStep * index
        const px = centerX + Math.cos(angle) * radius * percentage
        const py = centerY + Math.sin(angle) * radius * percentage
        if (index === 0) {
          ctx.moveTo(px, py)
        } else {
          ctx.lineTo(px, py)
        }
      }
    })
    ctx.closePath()
    ctx.stroke()
    ctx.setLineDash([])
  }

  // 値のポリゴン
  ctx.beginPath()
  ctx.fillStyle = `${colors.primary}40`
  ctx.strokeStyle = colors.primary
  ctx.lineWidth = 2
  data.forEach((item, index) => {
    const percentage = item.maxValue > 0 ? item.value / item.maxValue : 0
    const angle = startAngle + angleStep * index
    const px = centerX + Math.cos(angle) * radius * percentage
    const py = centerY + Math.sin(angle) * radius * percentage
    if (index === 0) {
      ctx.moveTo(px, py)
    } else {
      ctx.lineTo(px, py)
    }
  })
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // ラベル
  ctx.fillStyle = colors.text
  ctx.font = `${fontSize * 0.8}px sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  data.forEach((item, index) => {
    const angle = startAngle + angleStep * index
    const labelRadius = radius + fontSize
    const lx = centerX + Math.cos(angle) * labelRadius
    const ly = centerY + Math.sin(angle) * labelRadius
    const label = item.label.length > 6 ? item.label.substring(0, 6) + "..." : item.label
    ctx.fillText(label, lx, ly)
  })

  ctx.restore()
}

/**
 * 箱ひげ図を描画
 */
export function drawBoxPlot(
  ctx: CanvasRenderingContext2D,
  boxPlotData: BoxPlotData,
  yourScore: number,
  maxScore: number,
  x: number,
  y: number,
  config: ChartConfig,
): void {
  const { width, height, padding, colors, fontSize } = config

  ctx.save()
  ctx.translate(x, y)

  // 背景
  ctx.fillStyle = colors.background
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = colors.border
  ctx.strokeRect(0, 0, width, height)

  const graphX = padding + fontSize * 2
  const graphWidth = width - graphX - padding
  const graphY = padding + fontSize
  const graphHeight = height - graphY - padding - fontSize

  // スケール関数
  const scale = (value: number) => graphX + (value / maxScore) * graphWidth

  // 軸線
  ctx.strokeStyle = colors.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(graphX, graphY + graphHeight / 2)
  ctx.lineTo(graphX + graphWidth, graphY + graphHeight / 2)
  ctx.stroke()

  // 目盛り（0, 25%, 50%, 75%, 100%）
  ctx.fillStyle = colors.text
  ctx.font = `${fontSize * 0.7}px sans-serif`
  ctx.textAlign = "center"
  for (let i = 0; i <= 4; i++) {
    const value = (maxScore * i) / 4
    const tickX = scale(value)
    ctx.beginPath()
    ctx.moveTo(tickX, graphY + graphHeight / 2 - 3)
    ctx.lineTo(tickX, graphY + graphHeight / 2 + 3)
    ctx.stroke()
    ctx.fillText(String(Math.round(value)), tickX, graphY + graphHeight + fontSize * 0.8)
  }

  const boxHeight = graphHeight * 0.6
  const boxY = graphY + (graphHeight - boxHeight) / 2

  // ひげ（min〜Q1、Q3〜max）
  ctx.strokeStyle = colors.primary
  ctx.lineWidth = 2

  // 左のひげ
  ctx.beginPath()
  ctx.moveTo(scale(boxPlotData.min), graphY + graphHeight / 2)
  ctx.lineTo(scale(boxPlotData.q1), graphY + graphHeight / 2)
  ctx.stroke()

  // 左のひげの端
  ctx.beginPath()
  ctx.moveTo(scale(boxPlotData.min), boxY + boxHeight * 0.25)
  ctx.lineTo(scale(boxPlotData.min), boxY + boxHeight * 0.75)
  ctx.stroke()

  // 右のひげ
  ctx.beginPath()
  ctx.moveTo(scale(boxPlotData.q3), graphY + graphHeight / 2)
  ctx.lineTo(scale(boxPlotData.max), graphY + graphHeight / 2)
  ctx.stroke()

  // 右のひげの端
  ctx.beginPath()
  ctx.moveTo(scale(boxPlotData.max), boxY + boxHeight * 0.25)
  ctx.lineTo(scale(boxPlotData.max), boxY + boxHeight * 0.75)
  ctx.stroke()

  // 箱（Q1〜Q3）
  const boxX = scale(boxPlotData.q1)
  const boxWidth = scale(boxPlotData.q3) - boxX
  ctx.fillStyle = `${colors.primary}40`
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight)
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight)

  // 中央値
  ctx.strokeStyle = colors.secondary
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(scale(boxPlotData.median), boxY)
  ctx.lineTo(scale(boxPlotData.median), boxY + boxHeight)
  ctx.stroke()

  // 自分の点（マーカー）
  const yourX = scale(yourScore)
  ctx.fillStyle = "#ef4444"
  ctx.beginPath()
  ctx.moveTo(yourX, boxY - 8)
  ctx.lineTo(yourX - 6, boxY - 18)
  ctx.lineTo(yourX + 6, boxY - 18)
  ctx.closePath()
  ctx.fill()

  // 凡例
  ctx.fillStyle = "#ef4444"
  ctx.font = `bold ${fontSize * 0.8}px sans-serif`
  ctx.textAlign = "center"
  ctx.fillText("あなた", yourX, boxY - 22)

  ctx.restore()
}
